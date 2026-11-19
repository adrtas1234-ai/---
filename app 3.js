const chat = document.querySelector('#chat');
const form = document.querySelector('#composer');
const promptBox = document.querySelector('#prompt');
const sendBtn = document.querySelector('#sendBtn');
const settings = document.querySelector('#settings');
const endpointInput = document.querySelector('#endpoint');
const modelInput = document.querySelector('#model');
const keyInput = document.querySelector('#apiKey');
const statusLine = document.querySelector('#status');
const footnote = document.querySelector('#footnote');

const STORAGE = 'aion.messages.v1';
const CONFIG = 'aion.config.v1';

let messages = [];
try {
  messages = JSON.parse(localStorage.getItem(STORAGE) || '[]');
  if (!Array.isArray(messages)) messages = [];
} catch {
  messages = [];
}

let busy = false;

function saveMessages() {
  localStorage.setItem(STORAGE, JSON.stringify(messages));
}

function addBubble(role, text) {
  document.querySelector('#welcome')?.remove();

  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function render() {
  chat.innerHTML = '';

  if (!messages.length) {
    const w = document.createElement('div');
    w.className = 'welcome';
    w.id = 'welcome';
    w.innerHTML = '<div class="orb">✦</div><h1>Чем займёмся?</h1><p>Твоё пространство для вопросов, идей и исследований.</p><div class="suggestions"><button class="suggestion">Объясни сложную тему простыми словами</button><button class="suggestion">Помоги разобраться с новой идеей</button><button class="suggestion">Составь план обучения</button></div>';
    chat.appendChild(w);
    bindSuggestions();
    return;
  }

  messages.forEach(m => addBubble(m.role, m.content));
}

function bindSuggestions() {
  document.querySelectorAll('.suggestion').forEach(button => {
    button.addEventListener('click', () => {
      promptBox.value = button.textContent;
      promptBox.focus();
    });
  });
}

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG) || '{}');
  } catch {
    return {};
  }
}

function setBusy(value) {
  busy = value;
  sendBtn.disabled = value;
  sendBtn.textContent = value ? '…' : '↑';
}

async function askModel(history) {
  const cfg = getConfig();

  if (!cfg.endpoint || !cfg.model || !cfg.apiKey) {
    throw new Error('Заполни Endpoint, Model и API Key в настройках AION.');
  }

  // Можно указывать базовый адрес OpenRouter:
  // https://openrouter.ai/api/v1
  // Приложение само добавит /chat/completions.
  let endpoint = cfg.endpoint.trim().replace(/\/+$/, '');

  if (!endpoint.endsWith('/chat/completions')) {
    endpoint += '/chat/completions';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: history.map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      })),
      temperature: 0.7
    })
  });

  // Читаем текст ответа, чтобы показать подробную причину ошибки API.
  const raw = await response.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // Если сервер вернул не JSON, ниже покажем часть исходного ответа.
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      raw.slice(0, 300);

    throw new Error(
      `HTTP ${response.status}${detail ? ': ' + detail : ''}`
    );
  }

  const answer = data?.choices?.[0]?.message?.content;

  if (typeof answer === 'string') {
    return answer;
  }

  // Некоторые совместимые API могут возвращать содержимое частями.
  if (Array.isArray(answer)) {
    const combined = answer
      .map(part => typeof part === 'string' ? part : (part?.text || ''))
      .join('')
      .trim();

    if (combined) return combined;
  }

  throw new Error('Сервер ответил, но формат ответа не распознан.');
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const text = promptBox.value.trim();
  if (!text || busy) return;

  promptBox.value = '';
  promptBox.style.height = 'auto';

  messages.push({ role: 'user', content: text });
  saveMessages();
  addBubble('user', text);

  setBusy(true);

  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.textContent = 'AION формирует ответ…';
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;

  try {
    const answer = await askModel(messages.slice(-20));

    typing.remove();
    messages.push({ role: 'assistant', content: answer });
    saveMessages();
    addBubble('assistant', answer);
  } catch (error) {
    typing.remove();

    const message =
      `Не удалось получить ответ: ${error.message}. ` +
      'Проверь настройки модели и подключение к интернету.';

    messages.push({ role: 'assistant', content: message });
    saveMessages();
    addBubble('assistant', message);
  } finally {
    setBusy(false);
    promptBox.focus();
  }
});

promptBox.addEventListener('input', () => {
  promptBox.style.height = 'auto';
  promptBox.style.height = Math.min(promptBox.scrollHeight, 130) + 'px';
});

document.querySelector('#settingsBtn').addEventListener('click', () => {
  const config = getConfig();

  endpointInput.value = config.endpoint || '';
  modelInput.value = config.model || '';
  keyInput.value = config.apiKey || '';

  settings.showModal();
});

document.querySelector('#saveBtn').addEventListener('click', () => {
  const config = {
    endpoint: endpointInput.value.trim(),
    model: modelInput.value.trim(),
    apiKey: keyInput.value.trim()
  };

  localStorage.setItem(CONFIG, JSON.stringify(config));

  document.querySelector('#settingsStatus').textContent =
    'Настройки сохранены на этом устройстве.';

  statusLine.textContent = config.endpoint
    ? 'Модель настроена'
    : 'Личный ИИ-помощник';

  settings.close();
});

document.querySelector('#clearBtn').addEventListener('click', () => {
  if (confirm('Удалить всю историю диалогов на этом устройстве?')) {
    messages = [];
    saveMessages();
    render();
  }
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
