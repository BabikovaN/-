// Перевірка HTML-коду дитини: знаходить помилки, пояснює їх простими словами
// і пропонує виправлення. Повертає { errors: [...], fixed: 'виправлений код' }.
const L = (uk, en) => ({ uk, en });

export const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
export const KNOWN = ['html', 'head', 'body', 'title', 'meta', 'link', 'style', 'script', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'strong',
  'i', 'em', 'u', 's', 'mark', 'small', 'sub', 'sup', 'br', 'hr', 'a', 'img', 'ul', 'ol', 'li', 'div', 'span', 'button', 'input', 'label',
  'form', 'textarea', 'select', 'option', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'header', 'footer', 'main', 'nav', 'section',
  'article', 'aside', 'figure', 'figcaption', 'blockquote', 'q', 'code', 'pre', 'video', 'audio', 'iframe', 'center', 'font', 'marquee', 'details', 'summary'];
const REQUIRED_ATTR = { a: ['href'], img: ['src', 'alt'] };

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Схожі на вигляд символи, які діти часто плутають: l↔1, o↔0, кирилиця
const LOOKALIKE = { l: '1', '1': 'l', o: '0', '0': 'o', 'н': 'h', 'р': 'p', 'а': 'a', 'і': 'i', 'о': 'o', 'с': 'c', 'е': 'e', 'в': 'b', 'и': 'u' };
export function suggestTag(name) {
  const n = name.toLowerCase();
  const swapped = [...n].map((c) => LOOKALIKE[c] || c).join('');
  if (KNOWN.includes(swapped)) return swapped;
  let best = null, bd = 9;
  for (const k of KNOWN) { const dd = lev(n, k); if (dd < bd) { bd = dd; best = k; } }
  return bd <= Math.max(1, Math.floor(n.length / 2)) ? best : null;
}

const lineOf = (code, idx) => code.slice(0, idx).split('\n').length;

export function lint(code) {
  const errors = [];
  const stack = []; // {name, line, end}
  const edits = []; // {at, del, ins} для автовиправлення
  let i = 0;
  while (i < code.length) {
    const lt = code.indexOf('<', i);
    if (lt === -1) break;
    if (code.startsWith('<!--', lt)) {
      const end = code.indexOf('-->', lt + 4);
      if (end === -1) {
        errors.push({ line: lineOf(code, lt), msg: L('Коментар почався з <!--, але не закрився.', 'The comment starts with <!-- but never ends.'),
          fix: L('Додай --> у кінці коментаря.', 'Add --> at the end of the comment.') });
        edits.push({ at: code.length, del: 0, ins: ' -->' }); break;
      }
      i = end + 3; continue;
    }
    const next = code[lt + 1];
    if (!next || !/[a-zA-Z\/!а-яА-ЯіїєґІЇЄҐ]/.test(next)) { i = lt + 1; continue; } // просто символ «<» у тексті
    // кінець тегу: «>» раніше за наступний «<» або кінець рядка
    let gt = -1, nl = code.indexOf('\n', lt), nextLt = code.indexOf('<', lt + 1);
    for (let k = lt + 1; k < code.length; k++) {
      if (code[k] === '>') { gt = k; break; }
      if (code[k] === '<' || code[k] === '\n') break;
    }
    const line = lineOf(code, lt);
    if (gt === -1) {
      const stop = [nl, nextLt].filter((x) => x !== -1).reduce((a, b) => Math.min(a, b), code.length);
      const raw = code.slice(lt, stop).trimEnd();
      const nm = raw.match(/^<\/?\s*[^\s>\/]+/)[0];
      const tagOnly = nm.length < raw.length; // після назви тегу йде текст: <h1 Кіт
      const shown = tagOnly ? nm : raw;
      errors.push({ line, msg: L(`Після ${shown} забули кутову дужку «>».`, `You forgot the bracket “>” after ${shown}.`),
        fix: L(`Напиши «>» одразу після ${shown}, щоб вийшло ${shown}>`, `Type “>” right after ${shown} so it becomes ${shown}>`) });
      edits.push({ at: lt + (tagOnly ? nm.length : raw.length), del: 0, ins: '>' });
      i = lt + raw.length;
      // спробуємо все одно розібрати цей тег
      const m0 = raw.match(/^<\/?\s*([^\s>\/]+)/);
      if (m0) handleTag(m0[1], raw.startsWith('</'), raw, line, lt, lt + raw.length);
      continue;
    }
    const raw = code.slice(lt, gt + 1);
    i = gt + 1;
    if (raw.startsWith('<!')) continue; // <!DOCTYPE>
    const m = raw.match(/^<(\/)?\s*([^\s>\/]+)([\s\S]*?)(\/)?>$/);
    if (!m) continue;
    handleTag(m[2], !!m[1], raw, line, lt, gt + 1, m[3]);
  }

  function handleTag(nameRaw, closing, raw, line, start, end, attrs = '') {
    let name = nameRaw.toLowerCase();
    if (!KNOWN.includes(name)) {
      const s = suggestTag(name);
      if (s) {
        errors.push({ line, msg: L(`Тегу <${nameRaw}> не існує.`, `There is no <${nameRaw}> tag.`),
          fix: L(`Можливо, ти мав на увазі <${s}>? Зверни увагу на кожну літеру.`, `Did you mean <${s}>? Check every letter.`) });
        const p = start + raw.indexOf(nameRaw);
        edits.push({ at: p, del: nameRaw.length, ins: s });
        name = s;
      } else {
        errors.push({ line, msg: L(`Браузер не знає тег <${nameRaw}>.`, `The browser does not know the <${nameRaw}> tag.`),
          fix: L('Подивись у словнику, які теги бувають.', 'Look in the dictionary to see which tags exist.') });
        return;
      }
    }
    // лапки в атрибутах
    const q = (attrs.match(/"/g) || []).length, sq = (attrs.match(/'/g) || []).length;
    if (q % 2 || sq % 2) {
      errors.push({ line, msg: L('Лапки в атрибуті не закриті.', 'The quotes in an attribute are not closed.'),
        fix: L('Значення пишемо між двома лапками: href="https://…"', 'Put the value between two quotes: href="https://…"') });
      edits.push({ at: end - (raw.endsWith('/>') ? 2 : 1), del: 0, ins: q % 2 ? '"' : "'" });
    }
    if (!closing && REQUIRED_ATTR[name]) {
      for (const a of REQUIRED_ATTR[name]) {
        if (!new RegExp('\\b' + a + '\\s*=', 'i').test(attrs)) {
          const tip = { href: L('куди веде посилання: href="https://…"', 'where the link goes: href="https://…"'),
            src: L('звідки взяти картинку: src="assets/cat.svg"', 'where the picture is: src="assets/cat.svg"'),
            alt: L('опис картинки для тих, хто не бачить: alt="Котик"', 'a description for people who cannot see it: alt="Kitten"') }[a];
          errors.push({ line, msg: L(`У тегу <${name}> бракує атрибута ${a}.`, `The <${name}> tag is missing the ${a} attribute.`),
            fix: L(`Додай ${a} — ${tip.uk}`, `Add ${a} — ${tip.en}`) });
        }
      }
    }
    if (VOID.has(name)) {
      if (closing) { /* </br> — браузер пробачить */ }
      return;
    }
    if (!closing) { stack.push({ name, line, end }); return; }
    const idx = stack.map((s) => s.name).lastIndexOf(name);
    if (idx === -1 && stack.length) {
      const top = stack[stack.length - 1];
      errors.push({ line, msg: L(`Відкрили <${top.name}>, а закрили </${name}>. Вони мають бути однакові!`, `You opened <${top.name}> but closed </${name}>. They must match!`),
        fix: L(`Заміни </${name}> на </${top.name}>.`, `Replace </${name}> with </${top.name}>.`) });
      edits.push({ at: start, del: end - start, ins: `</${top.name}>` });
      stack.pop(); return;
    }
    if (idx === -1) {
      const ls = code.lastIndexOf('\n', start - 1) + 1;
      const before = code.slice(ls, start);
      errors.push({ line, msg: L(`Є закриваючий </${name}>, але немає відкриваючого <${name}>.`, `There is a closing </${name}> but no opening <${name}>.`),
        fix: L(`Додай <${name}> перед текстом або прибери зайвий </${name}>.`, `Add <${name}> before the text or remove the extra </${name}>.`) });
      if (before.trim() && !before.includes('<')) edits.push({ at: ls + (before.length - before.trimStart().length), del: 0, ins: `<${name}>` });
      else edits.push({ at: start, del: end - start, ins: '' });
      return;
    }
    // теги між ними не закриті
    for (let k = stack.length - 1; k > idx; k--) {
      const o = stack[k];
      errors.push({ line: o.line, msg: L(`Тег <${o.name}> відкрився, але не закрився.`, `The <${o.name}> tag was opened but never closed.`),
        fix: L(`Додай </${o.name}> перед </${name}>.`, `Add </${o.name}> before </${name}>.`) });
      edits.push({ at: start, del: 0, ins: `</${o.name}>` });
    }
    stack.length = idx;
  }

  for (let k = stack.length - 1; k >= 0; k--) {
    const o = stack[k];
    errors.push({ line: o.line, msg: L(`Тег <${o.name}> відкрився, але не закрився.`, `The <${o.name}> tag was opened but never closed.`),
      fix: L(`Додай </${o.name}> у кінці — як двері, які треба зачинити.`, `Add </${o.name}> at the end — like a door you need to close.`) });
    // закриваємо в кінці рядка, де тег відкрито, якщо це останній відкритий у рядку; інакше — в кінці коду
    const lineEnd = code.indexOf('\n', o.end);
    const at = k === stack.length - 1 && lineEnd !== -1 && !code.slice(o.end, lineEnd).includes('<') ? lineEnd : code.length;
    edits.push({ at, del: 0, ins: `</${o.name}>` });
  }

  const seen = new Set();
  const uniq = errors.filter((e) => { const k = e.line + e.msg.uk; if (seen.has(k)) return false; seen.add(k); return true; });
  errors.length = 0; errors.push(...uniq);
  errors.sort((a, b) => a.line - b.line);
  return { errors, fixed: applyEdits(code, edits) };
}

function applyEdits(code, edits) {
  const sorted = [...edits].sort((a, b) => b.at - a.at);
  let out = code;
  for (const e of sorted) out = out.slice(0, e.at) + e.ins + out.slice(e.at + e.del);
  return out;
}

// Розбір коду так, як це робить браузер (для перевірки завдань)
export function parseDoc(code) {
  return new DOMParser().parseFromString(code, 'text/html');
}
