// Акаунти й прогрес. Зберігаються в localStorage цього пристрою.
// Структуру зроблено так, щоб пізніше легко замінити на сервер (Supabase, Firebase).
const NS = 'pethtml:v2:';

function read(key, fallback) {
  try { const v = localStorage.getItem(NS + key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; } catch { return false; }
}

export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(normEmail(e));

export function getAccounts() { return read('accounts', {}); }

export function register({ name, email, age }) {
  const accounts = getAccounts(); const key = normEmail(email);
  if (accounts[key]) return { error: 'errExists' };
  accounts[key] = { name: name.trim(), email: key, age: Number(age) || null, created: Date.now() };
  write('accounts', accounts); write('session', key);
  return { user: accounts[key] };
}

export function login(email) {
  const key = normEmail(email); const acc = getAccounts()[key];
  if (!acc) return { error: 'errNoAcc' };
  write('session', key); return { user: acc };
}

export function logout() { write('session', null); }
export function currentUser() { const k = read('session', null); return k ? getAccounts()[k] || null : null; }

// ---------- прогрес поточного користувача ----------
const emptyProgress = () => ({ xp: 0, levels: {}, badges: [], streak: { count: 0, last: null }, exam: { best: 0, passed: false }, botQuestions: 0 });

export function getProgress() {
  const u = currentUser(); if (!u) return emptyProgress();
  return { ...emptyProgress(), ...read('progress:' + u.email, {}) };
}
export function saveProgress(p) { const u = currentUser(); if (u) write('progress:' + u.email, p); }

export function levelState(id) {
  return getProgress().levels[id] || { done: false, stars: 0, code: null, hints: 0, attempts: 0 };
}
export function updateLevel(id, patch) {
  const p = getProgress(); p.levels[id] = { ...levelState(id), ...patch }; saveProgress(p); return p.levels[id];
}

export function addXP(n) { const p = getProgress(); p.xp += n; touchStreak(p); saveProgress(p); return p.xp; }

function touchStreak(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.streak.last === today) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  p.streak.count = p.streak.last === y ? p.streak.count + 1 : 1;
  p.streak.last = today;
}

export function giveBadge(id) {
  const p = getProgress(); if (p.badges.includes(id)) return false;
  p.badges.push(id); saveProgress(p); return true;
}

// ---------- налаштування (мова, звук) ----------
export function getLang() { return read('lang', 'uk'); }
export function setLang(l) { write('lang', l); }
export function getSound() { return read('sound', true); }
export function setSound(v) { write('sound', !!v); }
