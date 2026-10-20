/* NELDO shared recipe page (r/index.html): reads the recipe from the part of the link after "#",
   shows it as plain text (textContent only, never HTML, never links), and offers Open in NELDO / Get NELDO.
   No network calls, no analytics. The recipe never goes into a request, an image URL or storage; only the
   visitor's language and theme choice are kept for this visit (sessionStorage, same keys as the site).
   The recipe shows in the page language when the link carries that version ("tr", library recipes);
   otherwise it shows as sent, with one small line saying which language it was shared in. Switching
   EN / ES / PT switches the recipe too. No translation happens here: only what the link carries. */
import { decodeRecipeLink, extractPayload, recipeForLanguage } from './recipe-link.js';

const root = document.documentElement;

/* ---------- theme: ?theme= for QA, then this visit's choice on the homepage (same as index.html) ---------- */
(function theme() {
  let t = null;
  try { t = new URLSearchParams(location.search).get('theme'); } catch (e) { /* old browser */ }
  if (t !== 'light' && t !== 'dark') { try { t = sessionStorage.getItem('neldo-theme'); } catch (e) { t = null; } }
  if (t !== 'light' && t !== 'dark') return;
  root.setAttribute('data-theme', t);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = t === 'dark' ? '#0d1311' : '#f8f6f0'; });
})();

/* ---------- words (EN / ES / PT). PT writes "a NELDO" like the rest of the site. ---------- */
const WORDS = {
  en: {
    title: 'A recipe shared from NELDO',
    pill: 'Shared recipe',
    open: 'Open in NELDO',
    get: 'Get NELDO',
    about: 'NELDO is a free app that helps you figure out what to cook with the time, energy and food you have. No account needed.',
    ingredients: 'Ingredients',
    steps: 'Steps',
    estimate: 'Estimate',
    perServing: 'Per serving',
    kcal: '{n} kcal', pro: '{n} g protein', carb: '{n} g carbs', fat: '{n} g fat',
    time: 'Total time',
    timer: 'Timer',
    serving: '{n} serving', servings: '{n} servings',
    brokenTitle: 'We couldn’t open this recipe',
    broken: 'This recipe link didn’t come through all the way. Ask whoever sent it to share it again.',
    home: 'Go to the NELDO homepage',
    footHome: 'NELDO home',
    privacy: 'Privacy',
    homeLabel: 'NELDO home',
    langLabel: 'Page language',
    siteLabel: 'NELDO',
    sharedIn: { en: 'This recipe was shared in English.', es: 'This recipe was shared in Spanish.', pt: 'This recipe was shared in Portuguese.' },
  },
  es: {
    title: 'Una receta compartida desde NELDO',
    pill: 'Receta compartida',
    open: 'Abrir en NELDO',
    get: 'Consigue NELDO',
    about: 'NELDO es una app gratis que te ayuda a decidir qué cocinar con el tiempo, la energía y la comida que tienes. No necesitas cuenta.',
    ingredients: 'Ingredientes',
    steps: 'Pasos',
    estimate: 'Estimación',
    perServing: 'Por porción',
    kcal: '{n} kcal', pro: '{n} g de proteína', carb: '{n} g de carbohidratos', fat: '{n} g de grasa',
    time: 'Tiempo total',
    timer: 'Temporizador',
    serving: '{n} porción', servings: '{n} porciones',
    brokenTitle: 'No pudimos abrir esta receta',
    broken: 'Este enlace de receta no llegó completo. Pídele a quien te lo mandó que lo comparta otra vez.',
    home: 'Ir a la página de NELDO',
    footHome: 'Inicio de NELDO',
    privacy: 'Privacidad',
    homeLabel: 'Inicio de NELDO',
    langLabel: 'Idioma de la página',
    siteLabel: 'NELDO',
    sharedIn: { en: 'Esta receta se compartió en inglés.', es: 'Esta receta se compartió en español.', pt: 'Esta receta se compartió en portugués.' },
  },
  pt: {
    title: 'Uma receita compartilhada pela NELDO',
    pill: 'Receita compartilhada',
    open: 'Abrir na NELDO',
    get: 'Baixe a NELDO',
    about: 'A NELDO é um app gratuito que ajuda você a decidir o que cozinhar com o tempo, a energia e a comida que você tem. Não precisa de conta.',
    ingredients: 'Ingredientes',
    steps: 'Modo de preparo',
    estimate: 'Estimativa',
    perServing: 'Por porção',
    kcal: '{n} kcal', pro: '{n} g de proteína', carb: '{n} g de carboidratos', fat: '{n} g de gordura',
    time: 'Tempo total',
    timer: 'Timer',
    serving: '{n} porção', servings: '{n} porções',
    brokenTitle: 'Não conseguimos abrir essa receita',
    broken: 'Esse link de receita não chegou completo. Peça para quem mandou compartilhar de novo.',
    home: 'Ir para a página da NELDO',
    footHome: 'Início da NELDO',
    privacy: 'Privacidade',
    homeLabel: 'Início da NELDO',
    langLabel: 'Idioma da página',
    siteLabel: 'NELDO',
    sharedIn: { en: 'Esta receita foi compartilhada em inglês.', es: 'Esta receita foi compartilhada em espanhol.', pt: 'Esta receita foi compartilhada em português.' },
  },
};
const LANGS = ['en', 'es', 'pt'];

/* LAUNCH: swap these for the App Store / Google Play links when NELDO is live in the stores
   (see the comment next to the Get NELDO button in r/index.html). Until then: the same email the
   homepage's Get NELDO button opens, in the same words per language (assets/js/i18n.js MAIL.join). */
const GET_HREF = {
  en: 'mailto:support@neldo.app?subject=Get%20NELDO&body=Hi%20NELDO%20team%2C%0D%0A%0D%0AI%27d%20like%20to%20get%20NELDO.%0D%0AMy%20phone%3A%20iPhone%20or%20Android%3F%20(pick%20one)%0D%0A%0D%0AThanks!',
  es: mail('Quiero NELDO', 'Hola, equipo de NELDO:\n\nMe gustaría conseguir NELDO.\nMi celular: ¿iPhone o Android? (elige uno)\n\n¡Gracias!'),
  pt: mail('Quero a NELDO', 'Olá, equipe da NELDO!\n\nQuero baixar a NELDO.\nMeu celular: iPhone ou Android? (escolha um)\n\nValeu!'),
};
function mail(subject, body) {
  const enc = (s) => encodeURIComponent(s).replace(/'/g, '%27');
  return 'mailto:support@neldo.app?subject=' + enc(subject) + '&body=' + enc(body.replace(/\n/g, '\r\n'));
}

let lang = 'en';
let langChosen = false;
let recipe = null;

const say = (key, n) => {
  const s = (WORDS[lang] && WORDS[lang][key]) || WORDS.en[key];
  return n === undefined ? s : s.replace('{n}', String(n));
};
const $ = (sel, scope) => (scope || document).querySelector(sel);
const $$ = (sel, scope) => (scope || document).querySelectorAll(sel);
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function minutesText(min) {
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? h + ' h ' + m + ' min' : h + ' h';
}
function timerText(sec) {
  if (sec < 60) return sec + ' s';
  if (sec >= 3600) return minutesText(Math.floor(sec / 60));
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? m + ' min ' + s + ' s' : m + ' min';
}

/* Open in NELDO: iPhone/iPad use the neldo:// scheme, Android an intent that falls back to this same recipe page
   when NELDO isn't installed, so the friend keeps reading. Desktop gets no Open button. The payload is checked to be base64url first. */
function openHref(payload) {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return 'neldo://r?d=' + payload;
  if (/Android/i.test(ua)) {
    return 'intent://r?d=' + payload + '#Intent;scheme=neldo;package=com.neldo.app;S.browser_fallback_url=' +
      encodeURIComponent(location.href) + ';end';
  }
  return null;
}

function applyWords() {
  root.lang = lang;
  $$('[data-t]').forEach((node) => { node.textContent = say(node.getAttribute('data-t')); });
  $$('[data-t-attr]').forEach((node) => {
    node.getAttribute('data-t-attr').split(';').forEach((pair) => {
      const i = pair.indexOf(':');
      if (i > 0) node.setAttribute(pair.slice(0, i).trim(), say(pair.slice(i + 1).trim()));
    });
  });
  $$('[data-get]').forEach((a) => { a.href = GET_HREF[lang]; });
  $$('[data-home]').forEach((a) => { a.href = lang === 'en' ? '../' : '../?lang=' + lang; });
  $$('[data-privacy]').forEach((a) => { a.href = lang === 'en' ? '../privacy.html' : '../privacy-' + lang + '.html'; });
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)));
}

function renderRecipe(sent) {
  const view = $('[data-view="recipe"]');
  // The version for the page language when the link has it, else the recipe as sent.
  const r = recipeForLanguage(sent, lang);
  const textLang = r.g || null;
  const setText = (node, text) => { node.textContent = text; if (textLang) node.lang = textLang; else node.removeAttribute('lang'); };

  setText($('[data-field="title"]', view), r.t);
  const desc = $('[data-field="desc"]', view);
  desc.hidden = !r.d;
  setText(desc, r.d || '');
  // No version in the page language: say which language it came in (the browser's own translate can help,
  // since every recipe line carries that language in its lang attribute).
  const note = $('[data-field="langnote"]', view);
  const noteText = textLang && textLang !== lang ? WORDS[lang].sharedIn[textLang] : '';
  note.hidden = !noteText;
  note.textContent = noteText || '';

  const time = $('[data-fact="time"]', view), serves = $('[data-fact="servings"]', view);
  time.hidden = !r.m;
  if (r.m) $('[data-value]', time).textContent = minutesText(r.m);
  serves.hidden = !r.s;
  if (r.s) $('[data-value]', serves).textContent = say(r.s === 1 ? 'serving' : 'servings', r.s);
  $('[data-field="facts"]', view).hidden = !r.m && !r.s;

  const ingredients = $('[data-field="ingredients"]', view);
  ingredients.replaceChildren();
  for (const item of r.i || []) {
    const li = el('li');
    if (textLang) li.lang = textLang;
    if (item.q) li.append(el('span', 'qty', item.q));
    li.append(el('span', 'name', item.n));
    ingredients.append(li);
  }
  $('[data-section="ingredients"]', view).hidden = !(r.i && r.i.length);

  const steps = $('[data-field="steps"]', view);
  steps.replaceChildren();
  (r.st || []).forEach((step, k) => {
    const li = el('li');
    li.append(el('span', 'num', String(k + 1)));
    const body = el('div');
    const text = el('p', '', step.x);
    if (textLang) text.lang = textLang;
    body.append(text);
    if (step.sec) {
      const chip = el('span', 'timer');
      const icon = $('#timer-icon');
      if (icon) chip.append(icon.content.cloneNode(true));
      chip.append(el('span', 'sr-only', say('timer') + ': '), el('span', '', timerText(step.sec)));
      body.append(chip);
    }
    li.append(body);
    steps.append(li);
  });
  $('[data-section="steps"]', view).hidden = !(r.st && r.st.length);

  const nu = r.nu || {};
  const parts = ['kcal', 'pro', 'carb', 'fat'].filter((k) => nu[k] !== undefined).map((k) => say(k, nu[k]));
  $('[data-section="nutrition"]', view).hidden = !parts.length;
  $('[data-field="nutrition"]', view).textContent = parts.length ? say('perServing') + ': ' + parts.join(' · ') : '';

  document.title = r.t + ' | NELDO';
}

function show(which) {
  $('[data-view="recipe"]').hidden = which !== 'recipe';
  $('[data-view="broken"]').hidden = which !== 'broken';
}

async function load() {
  const hash = location.hash || '';
  const payload = extractPayload(hash);
  recipe = payload ? await decodeRecipeLink(payload) : null;
  if (!langChosen && recipe && recipe.g) { lang = recipe.g; applyWords(); }
  if (!recipe) {
    document.title = say('title');
    show('broken');
    return;
  }
  const open = $('[data-open]');
  const href = openHref(payload);
  open.hidden = !href;
  if (href) open.href = href; else open.removeAttribute('href');
  // With an Open button, Get NELDO steps back to the outlined style.
  const get = $('[data-view="recipe"] [data-get]');
  get.classList.toggle('btn-primary', !href);
  get.classList.toggle('btn-ghost', !!href);
  renderRecipe(recipe);
  show('recipe');
}

function setLang(next, fromUser) {
  lang = LANGS.includes(next) ? next : 'en';
  applyWords();
  if (recipe) renderRecipe(recipe); else document.title = say('title');
  if (!fromUser) return;
  langChosen = true;
  try { sessionStorage.setItem('neldo-lang', lang); } catch (e) { /* private mode: this page only */ }
  try {
    const url = new URL(location.href);
    if (lang === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (e) { /* old browser */ }
}

/* Language: ?lang=, then this visit's choice on the site, then the sender's language, then English. */
(function init() {
  let pick = null;
  try { pick = new URLSearchParams(location.search).get('lang'); } catch (e) { /* old browser */ }
  if (!LANGS.includes(pick)) { try { pick = sessionStorage.getItem('neldo-lang'); } catch (e) { pick = null; } }
  if (LANGS.includes(pick)) { lang = pick; langChosen = true; }
  applyWords();
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.getAttribute('data-lang'), true)));
  window.addEventListener('hashchange', load);
  load();
})();
