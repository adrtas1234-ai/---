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
let messages = JSON.parse(localStorage.getItem(STORAGE) || '[]');
let busy = false;

function saveMessages(){ localStorage.setItem(STORAGE, JSON.stringify(messages)); }
function addBubble(role, text){
  document.querySelector('#welcome')?.remove();
  const wrap = document.createElement('div'); wrap.className = `message ${role}`;
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
  wrap.appendChild(bubble); chat.appendChild(wrap); chat.scrollTop = chat.scrollHeight;
}
function render(){ chat.innerHTML=''; if(!messages.length){ const w=document.createElement('div');w.className='welcome';w.id='welcome';w.innerHTML='<div class="orb">✦</div><h1>Чем займёмся?</h1><p>Твоё пространство для вопросов, идей и исследований.</p><div class="suggestions"><button class="suggestion">Объясни сложную тему простыми словами</button><button class="suggestion">Помоги разобраться с новой идеей</button><button class="suggestion">Составь план обучения</button></div>';chat.appendChild(w); bindSuggestions();return;} messages.forEach(m=>addBubble(m.role,m.content));}
function bindSuggestions(){document.querySelectorAll('.suggestion').forEach(b=>b.addEventListener('click',()=>{promptBox.value=b.textContent;promptBox.focus();}));}
function getConfig(){try{return JSON.parse(localStorage.getItem(CONFIG)||'{}')}catch{return {}}}
function setBusy(v){busy=v;sendBtn.disabled=v;sendBtn.textContent=v?'…':'↑';}
async function askModel(history){
  const cfg=getConfig();
  if(!cfg.endpoint || !cfg.model || !cfg.apiKey){
    return 'Интерфейс AION работает, но языковая модель ещё не подключена. Открой ⚙ и укажи endpoint, название модели и API-ключ совместимого провайдера. Само приложение не включает бесплатную модель или сервер.';
  }
  const response=await fetch(cfg.endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.apiKey}`},
    body:JSON.stringify({model:cfg.model,messages:history.map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),temperature:0.7})
  });
  if(!response.ok) throw new Error(`Сервис ответил HTTP ${response.status}`);
  const data=await response.json();
  const answer=data.choices?.[0]?.message?.content;
  if(typeof answer!=='string') throw new Error('Неожиданный формат ответа API');
  return answer;
}
form.addEventListener('submit',async e=>{
  e.preventDefault(); const text=promptBox.value.trim(); if(!text||busy)return;
  promptBox.value=''; promptBox.style.height='auto';
  messages.push({role:'user',content:text});saveMessages();addBubble('user',text);setBusy(true);
  const typing=document.createElement('div');typing.className='typing';typing.textContent='AION формирует ответ…';chat.appendChild(typing);chat.scrollTop=chat.scrollHeight;
  try{
    const answer=await askModel(messages.slice(-20));
    typing.remove();messages.push({role:'assistant',content:answer});saveMessages();addBubble('assistant',answer);
  }catch(err){typing.remove();const msg=`Не удалось получить ответ: ${err.message}. Проверь endpoint, ключ и подключение к интернету.`;messages.push({role:'assistant',content:msg});saveMessages();addBubble('assistant',msg);}
  finally{setBusy(false);promptBox.focus();}
});
promptBox.addEventListener('input',()=>{promptBox.style.height='auto';promptBox.style.height=Math.min(promptBox.scrollHeight,130)+'px';});
document.querySelector('#settingsBtn').addEventListener('click',()=>{
 const c=getConfig();endpointInput.value=c.endpoint||'';modelInput.value=c.model||'';keyInput.value=c.apiKey||'';settings.showModal();
});
document.querySelector('#saveBtn').addEventListener('click',()=>{
 const cfg={endpoint:endpointInput.value.trim(),model:modelInput.value.trim(),apiKey:keyInput.value.trim()};
 localStorage.setItem(CONFIG,JSON.stringify(cfg));document.querySelector('#settingsStatus').textContent='Настройки сохранены на этом устройстве.';statusLine.textContent=cfg.endpoint?'Модель настроена':'Личный ИИ-помощник';settings.close();
});
document.querySelector('#clearBtn').addEventListener('click',()=>{if(confirm('Удалить всю историю диалогов на этом устройстве?')){messages=[];saveMessages();render();}});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
render();
