// Котик Тег — помічник, що відповідає на питання дитини.
// Працює без інтернету: розпізнає питання за ключовими словами
// і враховує поточний рівень та останню помилку в коді.
import { TERMS } from './dictionary.js';
import { tr } from './i18n.js';
const L = (uk, en) => ({ uk, en });

const TAG_TO_TERM = { h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', p: 'paragraph', b: 'bold', strong: 'bold',
  i: 'italic', em: 'italic', br: 'br', hr: 'hr', a: 'link', img: 'image', ul: 'list', ol: 'list', li: 'li', table: 'table', tr: 'table', td: 'table', th: 'table',
  div: 'div', span: 'span', button: 'button', input: 'input', label: 'label', form: 'form', header: 'header', footer: 'footer', main: 'main', nav: 'nav', section: 'section',
  href: 'link', src: 'image', alt: 'alt' };

const INTENTS = [
  { id: 'greet', re: /^(привіт|привет|хай|добр|hi\b|hello|hey)/ },
  { id: 'thanks', re: /(дякую|спасиб|thank)/ },
  { id: 'who', re: /(хто ти|ти хто|who are you|your name|як тебе звати)/ },
  { id: 'error', re: /(помилк|чому не|не працю|не виходить|червон|неправильн|error|wrong|mistake|why|not work|doesn.?t work|broken|bug|баг)/ },
  { id: 'hint', re: /(підказ|допоможи|help|hint|не знаю|не розумію|don.?t know|stuck|як зробити|how do i)/ },
  { id: 'task', re: /(що робити|що треба|завдання|що далі|what (do|should) i|task|what now|next)/ },
  { id: 'close', re: /(закри|зачини|скісн|слеш|slash|close)/ },
  { id: 'imgfail', re: /((картинк|фото|img).*(не|нема|зник))|(image.*(not|missing|broken))/ },
  { id: 'color', re: /(колір|кольор|фарб|фон|color|colour|background|paint)/ },
  { id: 'what', re: /(що таке|що означає|що це|навіщо|для чого|what is|what does|what are|meaning|explain|поясни)/ },
];

export function answer(question, ctx) {
  const q = ' ' + question.toLowerCase().trim() + ' ';
  const lvl = ctx.level;
  // 1) питання про конкретне слово/тег
  const tagMatch = q.match(/<\/?\s*([a-z0-9]+)/) || q.match(/\b(h[1-6]|ul|ol|li|img|div|span|br|hr|nav|td|tr|href|src|alt)\b/);
  let termKey = tagMatch ? TAG_TO_TERM[tagMatch[1]] : null;
  if (!termKey) for (const [k, v] of Object.entries(TERMS)) {
    const words = [v.w.uk, v.w.en, k].map((w) => w.toLowerCase().split(' (')[0]);
    if (words.some((w) => w.length > 2 && q.includes(w.slice(0, Math.max(3, w.length - 2))))) { termKey = k; break; }
  }
  const intent = (INTENTS.find((it) => it.re.test(q)) || {}).id;

  if (intent === 'greet') return L(`Привіт, ${ctx.name}! 😺 ${lvl ? `Ми на рівні «${lvl.title.uk}». ` : ''}Питай що завгодно!`, `Hi, ${ctx.name}! 😺 ${lvl ? `We are on “${lvl.title.en}”. ` : ''}Ask me anything!`);
  if (intent === 'thanks') return L('Будь ласка! Ти чудово справляєшся 💛', 'You are welcome! You are doing great 💛');
  if (intent === 'who') return L('Я котик Тег 🐱 Я знаю все про HTML і допомагаю дітям робити сайти.', 'I am Tag the kitten 🐱 I know everything about HTML and help kids build websites.');

  if (intent === 'error' || intent === 'imgfail') {
    if (ctx.errors && ctx.errors.length) {
      const e = ctx.errors[0];
      return L(`Дивись на рядок ${e.line}: ${e.msg.uk}\n👉 ${e.fix.uk}`, `Look at line ${e.line}: ${e.msg.en}\n👉 ${e.fix.en}`);
    }
    if (ctx.taskMsg) return L(`Код без помилок, але завдання ще не виконане: ${ctx.taskMsg.uk}`, `Your code has no mistakes, but the task is not done yet: ${ctx.taskMsg.en}`);
    if (intent === 'imgfail') return L('Перевір src: має бути точна адреса, наприклад `src="assets/cat.svg"`. І лапки з обох боків!', 'Check src: it must be the exact address, like `src="assets/cat.svg"`. And quotes on both sides!');
    return L('Зараз помилок не бачу 👀 Натисни «Перевірити», і я подивлюсь ще раз.', 'I do not see mistakes right now 👀 Press “Check” and I will look again.');
  }
  if (intent === 'hint' && lvl) {
    const h = lvl.hints[Math.min(ctx.hintIndex, lvl.hints.length - 1)];
    return L(`Ось підказка: ${h.uk}`, `Here is a hint: ${h.en}`);
  }
  if (intent === 'task' && lvl) return L(`Завдання: ${lvl.task.uk}\nЯкщо важко — натисни «Вставити приклад» і зміни його.`, `Task: ${lvl.task.en}\nIf it is hard, press “Insert example” and change it.`);
  if (intent === 'close') return L('Більшість тегів треба закривати: відкрили `<p>`, написали текст, закрили `</p>` — зі скісною рискою /. Самотні теги `<br>`, `<hr>`, `<img>`, `<input>` не закриваються.', 'Most tags need closing: open `<p>`, write text, close `</p>` — with a slash /. Lonely tags `<br>`, `<hr>`, `<img>`, `<input>` are not closed.');
  if (intent === 'color') return L('Колір додаємо атрибутом style. Текст: `<p style="color: red">`. Фон: `<div style="background: yellow">`. Спробуй кольори: red, blue, green, pink, orange!', 'Add colour with the style attribute. Text: `<p style="color: red">`. Background: `<div style="background: yellow">`. Try colours: red, blue, green, pink, orange!');

  if (termKey) {
    const t = TERMS[termKey];
    return L(`${t.e} ${t.w.uk} — ${t.kid.uk}${t.ex ? `\nПриклад: \`${t.ex}\`` : ''}`, `${t.e} ${t.w.en} — ${t.kid.en}${t.ex ? `\nExample: \`${t.ex}\`` : ''}`);
  }
  if (intent === 'what' || intent === 'hint') return L('Спитай про конкретне слово, наприклад: «Що таке тег?», «Що таке <img>?», «Як закрити тег?»', 'Ask about a specific word, for example: “What is a tag?”, “What is <img>?”, “How do I close a tag?”');
  return L('Хм, я ще вчуся розуміти такі питання 🙈 Спробуй: «Що робити?», «Чому помилка?», «Що таке <p>?» або «Дай підказку».', 'Hmm, I am still learning to understand that 🙈 Try: “What do I do?”, “Why the error?”, “What is <p>?” or “Give me a hint”.');
}

export const answerText = (q, ctx) => tr(answer(q, ctx));
