import { t, tr } from './i18n.js';
import * as S from './storage.js';
import { LEVELS, levelById, WORLDS } from './levels.js';
import { TERMS } from './dictionary.js';
import { lint, parseDoc } from './checker.js';
import { answer } from './assistant.js';
import { sfx, confetti } from './fx.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// `код` у відповідях → <code>
const rich = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const $ = (sel, root = document) => root.querySelector(sel);

// ---------- котик Тег ----------
export function petSVG() {
  return `<svg class="pet-svg" viewBox="0 0 120 120" aria-hidden="true">
    <path d="M22 44 L30 12 L52 34 Z" fill="#8E7CFF"/><path d="M98 44 L90 12 L68 34 Z" fill="#8E7CFF"/>
    <path d="M29 38 L33 22 L45 34 Z" fill="#FFC9E3"/><path d="M91 38 L87 22 L75 34 Z" fill="#FFC9E3"/>
    <ellipse cx="60" cy="68" rx="42" ry="40" fill="#8E7CFF"/><ellipse cx="60" cy="80" rx="24" ry="18" fill="#EDE8FF"/>
    <circle cx="45" cy="62" r="7" fill="#2D2A32"/><circle cx="75" cy="62" r="7" fill="#2D2A32"/>
    <circle cx="47" cy="59" r="2.5" fill="#fff"/><circle cx="77" cy="59" r="2.5" fill="#fff"/>
    <path d="M56 74 Q60 78 64 74 Z" fill="#FF6B9D"/>
    <path class="mouth-idle" d="M60 77 Q55 84 50 80 M60 77 Q65 84 70 80" stroke="#2D2A32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path class="mouth-happy" d="M50 80 Q60 94 70 80 Z" fill="#2D2A32"/>
    <path class="tear" d="M78 70 Q82 78 78 82 Q74 78 78 70 Z" fill="#48DBFB"/>
    <text x="60" y="112" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="14" fill="#FECA57">&lt;/&gt;</text>
  </svg>`;
}
const petAccessory = (xp) => (xp >= 1500 ? '👑' : xp >= 900 ? '🎩' : xp >= 400 ? '🎀' : xp >= 150 ? '⭐' : '');
const pet = (mood = 'idle') => `<span class="pet ${mood}">${petSVG()}</span>`;
function setMood(mood) { document.querySelectorAll('.pet').forEach((p) => { p.classList.remove('idle', 'happy', 'sad', 'think'); p.classList.add(mood); }); }

function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }
function modal(html) {
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(bg); bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); }); return bg;
}

// ---------- досягнення ----------
const BADGES = {
  first: { e: '🐣', n: L('Перший рівень', 'First level') },
  five: { e: '🚀', n: L('5 рівнів', '5 levels') },
  ten: { e: '🌈', n: L('10 рівнів', '10 levels') },
  all: { e: '🏆', n: L('Усі 20 рівнів', 'All 20 levels') },
  nohint: { e: '🧠', n: L('Без підказок', 'No hints') },
  fixer: { e: '🔧', n: L('Виправив помилку', 'Fixed a bug') },
  chatty: { e: '💬', n: L('Допитливий', 'Curious mind') },
  quiz: { e: '🎯', n: L('Тест на відмінно', 'Perfect quiz') },
  exam: { e: '🎓', n: L('Склав іспит', 'Passed the exam') },
  streak3: { e: '🔥', n: L('3 дні поспіль', '3-day streak') },
};
function L(uk, en) { return { uk, en }; }
function award(id) { if (S.giveBadge(id)) { sfx('badge'); toast(`${BADGES[id].e} ${tr(BADGES[id].n)}!`); } }

// ---------- маршрутизація ----------
const routes = { '': welcome, auth: auth, map: mapPage, level: levelPage, dict: dictPage, exam: examPage, profile: profilePage, cert: certPage };
function go(hash) { location.hash = hash; }
function render() {
  const [route, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const user = S.currentUser();
  if (!user && !['', 'auth'].includes(route)) return go('#/auth/register');
  if (user && route === '') return go('#/map');
  document.documentElement.lang = S.getLang();
  document.title = `${t('appName')} — ${t('tagline')}`;
  closeChat();
  app.innerHTML = topbar(route) + '<main id="view"></main>' + (user ? chatFab() : '');
  (routes[route] || welcome)($('#view'), arg);
  bindTopbar();
  if (user) bindChat();
}
window.addEventListener('hashchange', render);

function topbar(route) {
  const u = S.currentUser(); const p = S.getProgress(); const lang = S.getLang();
  const nav = u ? `<button class="icon-btn burger" id="burger" aria-label="menu">☰</button>
    <nav class="nav" id="nav">
      <a href="#/map" class="${route === 'map' || route === 'level' ? 'active' : ''}">🗺️ ${t('map')}</a>
      <a href="#/dict" class="${route === 'dict' ? 'active' : ''}">📖 ${t('dictionary')}</a>
      <a href="#/exam" class="${route === 'exam' || route === 'cert' ? 'active' : ''}">🎓 ${t('exam')}</a>
      <a href="#/profile" class="${route === 'profile' ? 'active' : ''}">😺 ${t('profile')}</a>
    </nav>` : '';
  const stats = u ? `<span class="stat" title="${t('xp')}">⚡ ${p.xp}</span><span class="stat hide-m" title="${t('streak')}">🔥 ${p.streak.count}</span>` : '';
  return `<header class="topbar">
    <a class="logo" href="${u ? '#/map' : '#/'}">${petSVG()}<span>${t('appName')}</span><span class="pet-acc">${u ? petAccessory(p.xp) : ''}</span></a>
    ${nav}<div class="spacer"></div>${stats}
    <div class="lang"><button data-lang="uk" class="${lang === 'uk' ? 'on' : ''}">UA</button><button data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div>
    <button class="icon-btn" id="soundBtn" title="${t('sound')}">${S.getSound() ? '🔊' : '🔇'}</button>
  </header>`;
}
function bindTopbar() {
  document.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { S.setLang(b.dataset.lang); render(); });
  $('#soundBtn').onclick = () => { S.setSound(!S.getSound()); render(); };
  const burger = $('#burger'); if (burger) burger.onclick = () => $('#nav').classList.toggle('open');
}

// ---------- головна ----------
function welcome(v) {
  v.innerHTML = `<section class="hero">
    <div><h1>${esc(t('heroTitle')).replace(/(сайт|website)/i, '<span>$1</span>')}</h1><p>${t('heroText')}</p>
      <div class="hero-actions"><a class="btn btn-primary btn-big" href="#/auth/register">🚀 ${t('start')}</a><a class="btn btn-big" href="#/auth/login">${t('haveAccount')}</a></div></div>
    <div class="hero-art"><div class="mini-split">
      <div class="mini-code"><span class="tg">&lt;h1&gt;</span>Мій котик<span class="tg">&lt;/h1&gt;</span>
<span class="tg">&lt;p&gt;</span>Він любить
<span class="tg">&lt;b&gt;</span>рибку<span class="tg">&lt;/b&gt;</span>!<span class="tg">&lt;/p&gt;</span>
<span class="tg">&lt;img</span> <span class="at">src</span>="cat.svg"<span class="tg">&gt;</span></div>
      <div class="mini-site"><h1>Мій котик</h1><p>Він любить <b>рибку</b>!</p><img src="assets/cat.svg" alt="" width="90"></div>
    </div>${pet('happy')}</div>
  </section>
  <section class="features">
    <div class="feature"><span class="fi">🖥️</span>${t('feat1')}</div><div class="feature"><span class="fi">🐱</span>${t('feat2')}</div>
    <div class="feature"><span class="fi">📖</span>${t('feat3')}</div><div class="feature"><span class="fi">🏆</span>${t('feat4')}</div>
  </section>`;
}

// ---------- реєстрація / вхід ----------
function auth(v, mode = 'register') {
  const reg = mode !== 'login';
  v.innerHTML = `<form class="auth" id="authForm" novalidate>${pet('idle')}<h2>${reg ? t('register') : t('login')}</h2>
    ${reg ? `<div class="field"><label for="fName">${t('yourName')}</label><input id="fName" autocomplete="given-name" placeholder="${t('namePh')}" maxlength="30"></div>` : ''}
    <div class="field"><label for="fEmail">${t('email')}</label><input id="fEmail" type="email" autocomplete="email" placeholder="${t('emailPh')}"></div>
    ${reg ? `<div class="field"><label for="fAge">${t('age')}</label><select id="fAge">${[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((a) => `<option ${a === 9 ? 'selected' : ''}>${a}</option>`).join('')}<option value="16">16+</option></select></div>` : ''}
    <div class="err" id="fErr"></div>
    <button class="btn btn-primary btn-big" style="width:100%;justify-content:center">${reg ? t('createAcc') : t('enter')}</button>
    <button type="button" class="switch-link" id="switchAuth">${reg ? t('toLogin') : t('noAccount')}</button>
    <p class="small">🔒 ${t('privacy')}</p></form>`;
  $('#switchAuth').onclick = () => go(reg ? '#/auth/login' : '#/auth/register');
  $('#authForm').onsubmit = (e) => {
    e.preventDefault(); const err = $('#fErr'); const email = $('#fEmail').value;
    if (reg && $('#fName').value.trim().length < 2) { err.textContent = t('errName'); setMood('sad'); return; }
    if (!S.validEmail(email)) { err.textContent = t('errEmail'); setMood('sad'); return; }
    const r = reg ? S.register({ name: $('#fName').value, email, age: $('#fAge').value }) : S.login(email);
    if (r.error) { err.textContent = t(r.error); setMood('sad'); return; }
    sfx('success'); go('#/map');
  };
}

// ---------- карта рівнів ----------
const isUnlocked = (lvl) => lvl.id === 1 || S.levelState(lvl.id - 1).done;
const starsStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
function mapPage(v) {
  const p = S.getProgress(); const done = LEVELS.filter((l) => p.levels[l.id]?.done).length;
  const current = LEVELS.find((l) => !p.levels[l.id]?.done && isUnlocked(l));
  v.innerHTML = `<div class="page"><h1>${t('mapTitle')}</h1><p class="sub">${t('mapSub')}</p>
    <div class="bar" style="margin-bottom:22px"><i style="width:${(done / LEVELS.length) * 100}%"></i></div>
    ${WORLDS.map((w) => `<section class="world"><h2><span class="wn">${w}</span>${t('world.' + w)}</h2><div class="levels">
      ${LEVELS.filter((l) => l.world === w).map((l) => { const st = p.levels[l.id] || {}; const cls = st.done ? 'done' : !isUnlocked(l) ? 'locked' : l === current ? 'current' : '';
        return `<a class="lvl ${cls}" href="#/level/${l.id}" title="${isUnlocked(l) ? '' : t('locked')}"><div class="le">${l.emoji}</div><div class="ln">${t('level')} ${l.id}</div><div class="lt">${esc(tr(l.title))}</div><div class="ls">${starsStr(st.stars || 0)}</div></a>`; }).join('')}
    </div></section>`).join('')}</div>`;
}

// ---------- робочий екран рівня ----------
let W = null; // стан поточного рівня
function levelPage(v, id) {
  const lvl = levelById(id);
  if (!lvl) return go('#/map');
  if (!isUnlocked(lvl)) { toast(t('locked')); return go('#/map'); }
  const st = S.levelState(lvl.id);
  W = { lvl, hintIndex: 0, errors: [], taskMsg: null, fixed: null };
  const tagsInLevel = [...new Set([...lvl.example.matchAll(/<([a-z0-9]+)/g)].map((m) => m[1]))];
  const exampleText = lvl.example;
  v.innerHTML = `<div class="mobile-tabs no-print" style="padding:10px 10px 0"><button class="btn btn-sm btn-primary" id="tabCode">⌨️ ${t('yourCode')}</button><button class="btn btn-sm" id="tabSite">👀 ${t('preview')}</button></div>
  <div class="ws" id="ws">
    <section class="panel ws-left">
      <div class="lesson-head"><div class="le">${lvl.emoji}</div><div><div class="ln">${t('level')} ${lvl.id} / ${LEVELS.length}</div><h1>${esc(tr(lvl.title))}</h1></div></div>
      <details class="theory" ${st.done ? '' : 'open'}><summary>📚 ${t('lesson')}</summary><p>${esc(tr(lvl.theory))}</p>
        <div class="terms">${lvl.terms.filter((k) => TERMS[k]).map((k) => `<button class="term-chip" data-term="${k}">${TERMS[k].e} ${esc(tr(TERMS[k].w))}</button>`).join('')}</div></details>
      <div class="task"><b>🎯 ${t('task')}</b>${esc(tr(lvl.task))}</div>
      <div class="example"><pre>${esc(exampleText)}</pre><button class="btn btn-sm" id="useExample">📋 ${t('tryExample')}</button></div>
      <div class="palette"><span class="pl">${t('insert')}</span>${tagsInLevel.map((tg) => `<button data-tag="${tg}">&lt;${tg}&gt;</button>`).join('')}</div>
      <div class="editor" id="editor"><div class="gutter" id="gutter"></div><textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${t('typing')}"></textarea></div>
      <div class="actions"><button class="btn btn-green btn-big" id="checkBtn">✅ ${t('check')}</button><button class="btn" id="hintBtn">💡 ${t('hint')}</button><button class="btn btn-ghost" id="resetBtn">↺ ${t('reset')}</button></div>
      <div class="feedback info" id="fb">${pet('idle')}<div class="fb-body">${t('petMood.idle')}</div></div>
    </section>
    <section class="panel ws-right"><div class="browser-bar"><i style="background:#FF6B6B"></i><i style="background:#FECA57"></i><i style="background:#1DD1A1"></i><span class="url">🔒 ${t('preview')}</span></div>
      <iframe id="preview" title="preview" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe></section>
  </div>`;
  const ta = $('#code');
  ta.value = st.code ?? lvl.starter;
  let timer;
  ta.addEventListener('input', () => { updateGutter(); updatePreview(); clearTimeout(timer); setMood('think'); timer = setTimeout(() => liveLint(), 700); S.updateLevel(lvl.id, { code: ta.value }); });
  ta.addEventListener('scroll', () => { $('#gutter').scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); insertAtCursor('  '); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); checkLevel(); }
  });
  $('#useExample').onclick = () => { ta.value = exampleText; ta.dispatchEvent(new Event('input')); toast(t('copied')); sfx('click'); };
  document.querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => {
    const tg = b.dataset.tag; const VOIDS = ['br', 'hr', 'img', 'input'];
    const snippet = tg === 'img' ? '<img src="assets/cat.svg" alt="">' : tg === 'a' ? '<a href="https://">' + '|' + '</a>' : VOIDS.includes(tg) ? `<${tg}>` : `<${tg}>|</${tg}>`;
    insertAtCursor(snippet); sfx('click');
  });
  document.querySelectorAll('[data-term]').forEach((b) => b.onclick = () => showTerm(b.dataset.term));
  $('#checkBtn').onclick = checkLevel;
  $('#hintBtn').onclick = showHint;
  $('#resetBtn').onclick = () => { if (confirm(t('confirmReset'))) { ta.value = lvl.starter; ta.dispatchEvent(new Event('input')); } };
  $('#tabCode').onclick = () => { $('#ws').classList.remove('show-site'); $('#tabCode').classList.add('btn-primary'); $('#tabSite').classList.remove('btn-primary'); };
  $('#tabSite').onclick = () => { $('#ws').classList.add('show-site'); $('#tabSite').classList.add('btn-primary'); $('#tabCode').classList.remove('btn-primary'); };
  updateGutter(); updatePreview(); if (ta.value.trim()) liveLint();
}

function insertAtCursor(snippet) {
  const ta = $('#code'); const s = ta.selectionStart, e = ta.selectionEnd;
  const caret = snippet.indexOf('|'); const text = snippet.replace('|', '');
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  const pos = s + (caret === -1 ? text.length : caret);
  ta.focus(); ta.setSelectionRange(pos, pos); ta.dispatchEvent(new Event('input'));
}
function updateGutter(errLines = W?.errors.map((e) => e.line) || []) {
  const n = $('#code').value.split('\n').length;
  $('#gutter').innerHTML = Array.from({ length: n }, (_, i) => `<div class="${errLines.includes(i + 1) ? 'e' : ''}">${i + 1}</div>`).join('');
}
function updatePreview() {
  const code = $('#code').value;
  $('#preview').srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${location.href.split('#')[0]}" target="_blank"><style>body{font-family:'Nunito',system-ui,sans-serif;padding:14px;color:#2D2A32;line-height:1.5}img{max-width:100%}</style></head><body>${code}</body></html>`;
}
function liveLint() {
  const { errors, fixed } = lint($('#code').value);
  W.errors = errors; W.fixed = fixed; updateGutter();
  const ed = $('#editor'); ed.classList.toggle('bad', errors.length > 0); ed.classList.remove('good');
  if (errors.length) showErrors(errors); else if ($('#code').value.trim()) feedback('info', t('allGood'), 'idle');
  else feedback('info', t('petMood.idle'), 'idle');
}
function feedback(kind, html, mood) {
  const fb = $('#fb'); fb.className = 'feedback ' + kind;
  fb.innerHTML = `${pet(mood)}<div class="fb-body">${html}</div>`;
}
function showErrors(errors) {
  const list = errors.slice(0, 3).map((e) => `<div class="err-item"><span class="el">${t('line', { n: e.line })}</span>${esc(tr(e.msg))}<div class="ef">👉 ${esc(tr(e.fix))}</div></div>`).join('');
  feedback('bad', `${errors.length > 1 ? t('foundMany', { n: errors.length }) : t('found')}${list}
    <div class="actions" style="margin-top:8px"><button class="btn btn-sm" id="showFix">🔍 ${t('showFix')}</button></div><div class="fix-box hidden" id="fixBox"></div>`, 'sad');
  $('#showFix').onclick = () => {
    const box = $('#fixBox'); box.classList.remove('hidden');
    box.innerHTML = `<div style="margin-top:8px">${t('fixedCode')}</div><pre>${esc(W.fixed)}</pre><button class="btn btn-sm btn-orange" id="applyFix">🪄 ${t('applyFix')}</button>`;
    $('#applyFix').onclick = () => { $('#code').value = W.fixed; $('#code').dispatchEvent(new Event('input')); W.usedFix = true; award('fixer'); sfx('click'); liveLint(); };
  };
}
function showHint() {
  const lvl = W.lvl;
  if (W.hintIndex >= lvl.hints.length) { feedback('warn', t('noMoreHints'), 'think'); openChat(); return; }
  const h = lvl.hints[W.hintIndex]; W.hintIndex++;
  S.updateLevel(lvl.id, { hints: Math.max(S.levelState(lvl.id).hints, W.hintIndex) });
  feedback('warn', `<b>💡 ${t('hintN', { n: W.hintIndex, m: lvl.hints.length })}</b><br>${rich(tr(h))}`, 'think'); sfx('click');
}
function checkLevel() {
  const code = $('#code').value; const lvl = W.lvl;
  const st = S.updateLevel(lvl.id, { attempts: S.levelState(lvl.id).attempts + 1, code });
  const { errors, fixed } = lint(code); W.errors = errors; W.fixed = fixed; updateGutter();
  if (!code.trim()) { feedback('warn', t('typing'), 'think'); return; }
  if (errors.length) { $('#editor').classList.add('bad'); showErrors(errors); sfx('error'); return; }
  const msg = lvl.check(parseDoc(code), code); W.taskMsg = msg;
  if (msg) { feedback('warn', `${t('taskNotYet')}<div class="err-item">🎯 ${esc(tr(msg))}</div>`, 'think'); sfx('error'); return; }
  // успіх!
  $('#editor').classList.remove('bad'); $('#editor').classList.add('good');
  const firstTime = !st.done;
  const stars = Math.max(1, 3 - Math.min(2, st.hints) - (W.usedFix ? 1 : 0));
  S.updateLevel(lvl.id, { done: true, stars: Math.max(stars, st.stars || 0) });
  if (firstTime) S.addXP(50 + stars * 10);
  feedback('ok', `🎉 ${t('success')}`, 'happy'); sfx('success'); confetti();
  const p = S.getProgress(); const doneN = LEVELS.filter((l) => p.levels[l.id]?.done).length;
  if (doneN >= 1) award('first'); if (doneN >= 5) award('five'); if (doneN >= 10) award('ten'); if (doneN >= LEVELS.length) award('all');
  if (st.hints === 0 && !W.usedFix) award('nohint'); if (p.streak.count >= 3) award('streak3');
  setTimeout(() => runQuiz(lvl, stars), 900);
}

// ---------- міні-тест ----------
function runQuiz(lvl, stars) {
  let i = 0, right = 0;
  const m = modal('<div id="qz"></div>');
  const step = () => {
    if (i >= lvl.quiz.length) return finish();
    const q = lvl.quiz[i];
    $('#qz', m).innerHTML = `<div class="qcount">${t('quizTitle')} · ${i + 1}/${lvl.quiz.length}</div><h2>${esc(tr(q.q))}</h2>
      <div class="answers">${q.a.map((a, k) => `<button data-k="${k}">${esc(tr(a))}</button>`).join('')}</div><div id="qres" class="err" style="color:inherit"></div>`;
    m.querySelectorAll('.answers button').forEach((b) => b.onclick = () => {
      const k = Number(b.dataset.k); const ok = q.c === -1 || k === q.c;
      m.querySelectorAll('.answers button').forEach((x) => { x.disabled = true; if (q.c === -1 ? x === b : Number(x.dataset.k) === q.c) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong'); else right++;
      sfx(ok ? 'success' : 'error');
      $('#qres', m).innerHTML = `${ok ? t('quizRight') : t('quizWrong')}<div style="margin-top:12px"><button class="btn btn-primary" id="qnext">${t('quizNext')} →</button></div>`;
      $('#qnext', m).onclick = () => { i++; step(); };
    });
  };
  const finish = () => {
    if (right === lvl.quiz.length) award('quiz');
    S.addXP(right * 10);
    const next = levelById(lvl.id + 1);
    $('#qz', m).innerHTML = `${pet('happy')}<h2>${t('success')}</h2><div class="big-stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? '' : 'off'}">⭐</span>`).join('')}</div>
      <p>⚡ +${50 + stars * 10 + right * 10} ${t('xp')}</p><div class="actions" style="justify-content:center">
      ${next ? `<a class="btn btn-primary btn-big" href="#/level/${next.id}">${t('nextLevel')} →</a>` : `<a class="btn btn-primary btn-big" href="#/exam">🎓 ${t('exam')}</a>`}
      <a class="btn" href="#/map">${t('toMap')}</a></div>`;
    m.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => m.remove()));
    confetti();
  };
  step();
}

function showTerm(k) {
  const x = TERMS[k];
  const m = modal(`<div class="term-pop"><div class="te">${x.e}</div><h2>${esc(tr(x.w))}</h2><p>${esc(tr(x.kid))}</p>${x.ex ? `<pre class="mini-code" style="min-height:0">${esc(x.ex)}</pre>` : ''}<button class="btn btn-primary" id="tClose">OK</button></div>`);
  $('#tClose', m).onclick = () => m.remove();
}

// ---------- словник ----------
function dictPage(v) {
  v.innerHTML = `<div class="page"><h1>📖 ${t('dictTitle')}</h1><p class="sub">${t('dictSub')}</p><input class="dict-search" id="dq" placeholder="🔍 ${t('search')}"><div class="dict" id="dl"></div></div>`;
  const draw = (q = '') => {
    const ql = q.toLowerCase();
    $('#dl').innerHTML = Object.entries(TERMS).filter(([k, x]) => !ql || [k, x.w.uk, x.w.en, x.kid.uk, x.kid.en, x.ex].join(' ').toLowerCase().includes(ql))
      .map(([, x]) => `<article class="dcard"><div class="de">${x.e}</div><h3>${esc(tr(x.w))}</h3><p>${esc(tr(x.kid))}</p>${x.ex ? `<code>${esc(x.ex)}</code>` : ''}</article>`).join('');
  };
  $('#dq').oninput = (e) => draw(e.target.value); draw();
}

// ---------- іспит ----------
function examPage(v) {
  const p = S.getProgress(); const done = LEVELS.filter((l) => p.levels[l.id]?.done).length;
  if (done < 10) { v.innerHTML = `<div class="page" style="text-align:center">${pet('think')}<h1>🎓 ${t('examTitle')}</h1><p class="sub">${t('examLocked')}</p><div class="bar" style="max-width:420px;margin:0 auto"><i style="width:${done * 10}%"></i></div><p>${done} / 10</p><a class="btn btn-primary" href="#/map">${t('toMap')}</a></div>`; return; }
  v.innerHTML = `<div class="page" style="text-align:center">${pet('idle')}<h1>🎓 ${t('examTitle')}</h1><p class="sub">${t('examSub')}</p>
    <button class="btn btn-primary btn-big" id="startExam">${t('examStart')}</button>${p.exam.passed ? ` <a class="btn btn-big" href="#/cert">📜 ${t('certificate')}</a>` : ''}</div>`;
  $('#startExam').onclick = () => {
    const pool = LEVELS.filter((l) => p.levels[l.id]?.done).flatMap((l) => l.quiz.filter((q) => q.c !== -1));
    const qs = pool.sort(() => Math.random() - 0.5).slice(0, 10);
    let i = 0, right = 0;
    const step = () => {
      if (i >= qs.length) {
        const pass = right >= Math.ceil(qs.length * 0.7);
        const pr = S.getProgress(); pr.exam.best = Math.max(pr.exam.best, right); if (pass) pr.exam.passed = true; S.saveProgress(pr);
        if (pass) { award('exam'); confetti(); sfx('success'); }
        v.innerHTML = `<div class="page" style="text-align:center">${pet(pass ? 'happy' : 'sad')}<h1>${t('examResult', { n: right, m: qs.length })}</h1><p class="sub">${pass ? t('examPass') : t('examFail')}</p>
          ${pass ? `<a class="btn btn-primary btn-big" href="#/cert">📜 ${t('certificate')}</a>` : `<a class="btn btn-primary btn-big" href="#/exam">${t('again')}</a>`}</div>`;
        return;
      }
      const q = qs[i];
      v.innerHTML = `<div class="page"><div class="modal" style="margin:0 auto;animation:none"><div class="qcount">${t('exam')} · ${i + 1}/${qs.length}</div><h2>${esc(tr(q.q))}</h2>
        <div class="answers">${q.a.map((a, k) => `<button data-k="${k}">${esc(tr(a))}</button>`).join('')}</div></div></div>`;
      v.querySelectorAll('.answers button').forEach((b) => b.onclick = () => {
        const ok = Number(b.dataset.k) === q.c; if (ok) right++;
        v.querySelectorAll('.answers button').forEach((x) => { x.disabled = true; if (Number(x.dataset.k) === q.c) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong'); sfx(ok ? 'success' : 'error');
        setTimeout(() => { i++; step(); }, 900);
      });
    };
    step();
  };
}

// ---------- сертифікат ----------
function certPage(v) {
  const p = S.getProgress(); const u = S.currentUser();
  if (!p.exam.passed) return go('#/exam');
  v.innerHTML = `<div class="page cert-wrap"><h1>📜 ${t('certificate')}</h1><canvas id="cert" width="1600" height="1130"></canvas>
    <div class="actions no-print" style="justify-content:center;margin-top:16px"><button class="btn btn-primary btn-big" id="dl">⬇️ ${t('download')}</button></div></div>`;
  const c = $('#cert'); const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1600, 1130); grad.addColorStop(0, '#FFF8EE'); grad.addColorStop(1, '#F1ECFF');
  g.fillStyle = grad; g.fillRect(0, 0, 1600, 1130);
  g.strokeStyle = '#6C5CE7'; g.lineWidth = 18; g.strokeRect(40, 40, 1520, 1050); g.strokeStyle = '#FECA57'; g.lineWidth = 6; g.strokeRect(70, 70, 1460, 990);
  g.textAlign = 'center'; g.fillStyle = '#6C5CE7'; g.font = '900 96px Nunito, sans-serif'; g.fillText(t('certTitle'), 800, 250);
  g.fillStyle = '#6E6878'; g.font = '700 40px Nunito, sans-serif'; g.fillText(t('certText'), 800, 340);
  g.fillStyle = '#2D2A32'; g.font = '900 110px Nunito, sans-serif'; g.fillText(u.name, 800, 490);
  g.fillStyle = '#2D2A32'; g.font = '700 38px Nunito, sans-serif';
  const words = t('certText2').split(' '); let line = '', y = 600;
  for (const w of words) { if (g.measureText(line + w).width > 1200) { g.fillText(line, 800, y); line = ''; y += 54; } line += w + ' '; } g.fillText(line, 800, y);
  g.font = '700 34px Nunito, sans-serif'; g.fillStyle = '#6E6878';
  g.fillText(`⭐ ${Object.values(p.levels).reduce((s, l) => s + (l.stars || 0), 0)}   ⚡ ${p.xp} XP   ✅ ${Object.values(p.levels).filter((l) => l.done).length}/${LEVELS.length}`, 800, 860);
  g.fillText(new Date().toLocaleDateString(S.getLang() === 'uk' ? 'uk-UA' : 'en-GB'), 800, 930);
  g.font = '900 44px Nunito, sans-serif'; g.fillStyle = '#6C5CE7'; g.fillText('Pet HTML 🐱', 800, 1010);
  $('#dl').onclick = () => { const a = document.createElement('a'); a.download = 'certificate-pet-html.png'; a.href = c.toDataURL('image/png'); a.click(); };
}

// ---------- профіль ----------
function profilePage(v) {
  const u = S.currentUser(); const p = S.getProgress();
  const done = LEVELS.filter((l) => p.levels[l.id]?.done).length; const stars = Object.values(p.levels).reduce((s, l) => s + (l.stars || 0), 0);
  v.innerHTML = `<div class="page"><div class="profile-top">${pet('happy')}<div style="flex:1"><h1 style="margin:0">${esc(u.name)} <span class="pet-acc">${petAccessory(p.xp)}</span></h1><div class="small">${esc(u.email)}</div>
      <div class="bar" style="margin-top:10px"><i style="width:${(done / LEVELS.length) * 100}%"></i></div><div class="small">${t('levelsDone')}: ${done}/${LEVELS.length}</div></div>
      <div class="actions">${p.exam.passed ? `<a class="btn btn-primary" href="#/cert">📜 ${t('certificate')}</a>` : ''}<button class="btn" id="logout">🚪 ${t('logout')}</button></div></div>
    <div class="stats"><div class="s"><b>⚡ ${p.xp}</b>${t('xp')}</div><div class="s"><b>⭐ ${stars}</b>${t('stars')}</div><div class="s"><b>🔥 ${p.streak.count}</b>${t('streak')}</div><div class="s"><b>🎓 ${p.exam.best}/10</b>${t('exam')}</div></div>
    <h2>${t('badges')}</h2><div class="badges">${Object.entries(BADGES).map(([k, b]) => `<div class="badge ${p.badges.includes(k) ? '' : 'off'}"><span class="be">${b.e}</span>${esc(tr(b.n))}</div>`).join('')}</div></div>`;
  $('#logout').onclick = () => { S.logout(); go('#/'); };
}

// ---------- чат з котиком ----------
let chatLog = [];
function chatFab() {
  return `<button class="chat-fab no-print" id="chatFab" aria-label="${t('helper')}"><span class="bubble">${t('chip1')}</span>${pet('idle')}</button>
  <div class="chat hidden" id="chat" role="dialog" aria-label="${t('helper')}"><div class="chat-head">${petSVG()} ${t('helper')}<button id="chatClose" aria-label="close">×</button></div>
    <div class="chat-msgs" id="msgs"></div>
    <div class="chips">${['chip1', 'chip2', 'chip3', 'chip4'].map((c) => `<button data-chip="${c}">${t(c)}</button>`).join('')}</div>
    <form class="chat-form" id="chatForm"><input id="chatIn" placeholder="${t('askPh')}" autocomplete="off"><button class="btn btn-primary btn-sm">➤</button></form></div>`;
}
function bindChat() {
  $('#chatFab').onclick = () => ($('#chat').classList.contains('hidden') ? openChat() : closeChat());
  $('#chatClose').onclick = closeChat;
  $('#chatForm').onsubmit = (e) => { e.preventDefault(); const q = $('#chatIn').value.trim(); if (q) { ask(q); $('#chatIn').value = ''; } };
  document.querySelectorAll('[data-chip]').forEach((b) => b.onclick = () => ask(b.textContent));
}
function openChat() {
  const c = $('#chat'); if (!c) return; c.classList.remove('hidden');
  if (!chatLog.length) chatLog.push({ who: 'bot', text: t('botHello', { name: S.currentUser().name }) });
  drawChat(); $('#chatIn').focus();
}
function closeChat() { const c = $('#chat'); if (c) c.classList.add('hidden'); }
function drawChat(typing = false) {
  const m = $('#msgs'); if (!m) return;
  m.innerHTML = chatLog.map((x) => `<div class="msg ${x.who}">${rich(x.text)}</div>`).join('') + (typing ? '<div class="msg bot typing"><span></span><span></span><span></span></div>' : '');
  m.scrollTop = m.scrollHeight;
}
function ask(q) {
  chatLog.push({ who: 'me', text: q }); drawChat(true);
  const p = S.getProgress(); p.botQuestions = (p.botQuestions || 0) + 1; S.saveProgress(p); if (p.botQuestions >= 5) award('chatty');
  const onLevel = location.hash.startsWith('#/level') && W;
  if (onLevel && $('#code')) { const r = lint($('#code').value); W.errors = r.errors; if (!r.errors.length && $('#code').value.trim()) W.taskMsg = W.lvl.check(parseDoc($('#code').value), $('#code').value); }
  const ctx = { name: S.currentUser().name, level: onLevel ? W.lvl : null, errors: onLevel ? W.errors : [], taskMsg: onLevel ? W.taskMsg : null, hintIndex: onLevel ? W.hintIndex : 0 };
  setTimeout(() => { chatLog.push({ who: 'bot', text: tr(answer(q, ctx)) }); drawChat(); sfx('pop'); }, 600);
}

render();
