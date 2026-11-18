// Звуки (без файлів — синтез у браузері) і конфеті.
import { getSound } from './storage.js';
let ctx;
const NOTES = {
  success: [[523, 0], [659, .09], [784, .18], [1046, .27]],
  error: [[220, 0], [180, .12]],
  click: [[880, 0]],
  pop: [[660, 0], [990, .06]],
  badge: [[784, 0], [988, .1], [1175, .2], [1568, .3]],
};
export function sfx(name) {
  if (!getSound()) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    for (const [f, at] of NOTES[name] || []) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = name === 'error' ? 'triangle' : 'sine'; o.frequency.value = f;
      const t0 = ctx.currentTime + at;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.25);
    }
  } catch { /* звук недоступний — не страшно */ }
}

export function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c);
  const g = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const colors = ['#6C5CE7', '#FF9F43', '#20BF6B', '#FF6B9D', '#FECA57', '#48DBFB'];
  const parts = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4, r: 4 + Math.random() * 6,
    vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4, a: Math.random() * 6, va: -0.2 + Math.random() * 0.4, col: colors[(Math.random() * colors.length) | 0] }));
  let frames = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.col; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); }
    if (++frames < 150) requestAnimationFrame(tick); else c.remove();
  })();
}
