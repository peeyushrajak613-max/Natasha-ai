const $ = id => document.getElementById(id);
const orb = $('orb'), statusEl = $('status'), log = $('log');
const LANGS = { en: { rec: 'en-IN', tts: 'en-IN', label: 'EN', hint: 'Tap the orb and speak', listen: 'Listening…', think: 'Thinking…' },
                hi: { rec: 'hi-IN', tts: 'hi-IN', label: 'हि', hint: 'ऑर्ब दबाकर बोलिए', listen: 'सुन रही हूँ…', think: 'सोच रही हूँ…' } };
let lang = localStorage.getItem('lang') || 'en';
let muted = localStorage.getItem('muted') === '1';
let history = [], rec = null, listening = false, audio = null, busy = false, speaking = false;

setTimeout(() => $('splash').classList.add('hide'), 900);
function setOrb(s) { orb.className = 'orb ' + s; }
function setStatus(t) { statusEl.textContent = t; }
function applyUi() {
  $('lang').textContent = LANGS[lang].label;
  $('mute').textContent = muted ? '🔇' : '🔊';
  $('mute').setAttribute('aria-pressed', muted);
  $('mute').setAttribute('aria-label', muted ? 'Voice output off' : 'Voice output on');
  document.documentElement.lang = lang;
  if (!busy && !listening) setStatus(LANGS[lang].hint);
}
function add(role, text) {
  const d = document.createElement('div'); d.className = 'msg ' + role; d.textContent = text;
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}
$('lang').onclick = () => { lang = lang === 'en' ? 'hi' : 'en'; localStorage.setItem('lang', lang); stopAll(); applyUi(); };
$('mute').onclick = () => { muted = !muted; localStorage.setItem('muted', muted ? '1' : '0'); if (muted) stopAudio(); applyUi(); };

function stopAudio() { speaking = false; if (audio) { audio.pause(); audio = null; } speechSynthesis.cancel(); if (!busy && !listening) setOrb('idle'); }
function stopAll() { if (rec) try { rec.abort(); } catch (e) {} listening = false; stopAudio(); setOrb('idle'); }

async function send(text) {
  text = text.trim(); if (!text || busy) return;
  busy = true; stopAudio(); add('user', text); history.push({ role: 'user', content: text });
  setOrb('thinking'); setStatus(LANGS[lang].think);
  let reply = null;
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12), lang }) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
    reply = j.reply;
  } catch (e) {
    if (history.length && history[history.length - 1].role === 'user') history.pop();
    add('err', e instanceof TypeError ? 'No connection. Check your internet.' : e.message);
  }
  busy = false;
  if (reply) { history.push({ role: 'assistant', content: reply }); history = history.slice(-20); add('bot', reply); await speak(reply); }
  if (!speaking) { setOrb('idle'); applyUi(); }
}

async function speak(text) {
  if (muted) return;
  const clean = text.replace(/[*_`#>]/g, '').slice(0, 900);
  speaking = true; setOrb('speaking'); setStatus('…');
  const done = () => { if (!speaking) return; speaking = false; audio = null; setOrb('idle'); applyUi(); };
  try {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clean }) });
    if (!r.ok) throw new Error('tts');
    const blob = await r.blob();
    if (!speaking) return;
    const url = URL.createObjectURL(blob), a = new Audio(url); audio = a;
    a.onended = a.onerror = () => { URL.revokeObjectURL(url); done(); };
    await a.play();
  } catch (e) {
    if (!speaking) return;
    audio = null;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = /[\u0900-\u097F]/.test(clean) ? 'hi-IN' : LANGS[lang].tts;
    u.onend = u.onerror = done;
    speechSynthesis.speak(u);
  }
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
orb.onclick = () => {
  if (listening) { rec.stop(); return; }
  if (!SR) { add('err', lang === 'hi' ? 'इस ब्राउज़र में आवाज़ पहचान नहीं है। टाइप करें।' : 'Voice input is not supported here. Type instead.'); return; }
  stopAudio(); rec = new SR(); rec.lang = LANGS[lang].rec; rec.interimResults = false;
  rec.onstart = () => { listening = true; setOrb('listening'); setStatus(LANGS[lang].listen); };
  rec.onresult = e => send(e.results[0][0].transcript);
  rec.onerror = e => {
    const m = { 'not-allowed': 'Microphone permission is blocked. Allow it in Chrome site settings.', 'service-not-allowed': 'Speech recognition is blocked on this device.',
      'audio-capture': 'No microphone found.', 'network': 'Voice recognition needs an internet connection.' }[e.error];
    if (m) add('err', m);
  };
  rec.onend = () => { listening = false; if (!busy && !audio) { setOrb('idle'); applyUi(); } };
  try { rec.start(); } catch (e) { listening = false; setOrb('idle'); }
};
$('form').onsubmit = e => { e.preventDefault(); if (busy) return; const t = $('text').value; $('text').value = ''; send(t); };

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
applyUi();
