/* NELDO shared recipe links: the decoder for www.neldo.app/r/ (and for tests in Node 24).
   No libraries, no network calls, no storage. It only reads the text it is given.

   Link format (the app builds these; both sides must match):
     https://www.neldo.app/r/#1.<data>    also accepted: neldo://r?d=1.<data>, neldo://r#1.<data>, "#1.<data>", "1.<data>"
     <data> = base64url (RFC 4648 section 5 alphabet, no padding) of raw DEFLATE (RFC 1951, no zlib/gzip header)
              of the UTF-8 JSON. Prefix "0." = the same JSON with no compression. Encoders send "1.".
   The recipe rides only after "#", so browsers never send it to any server (GitHub Pages included).

   JSON (short keys, unknown keys ignored):
     {"v":1, "t": title (required, max 120), "d": one-line description (max 300), "m": total minutes (int 1..1440),
      "s": servings (int 1..50), "i": [{"q": amount (max 40), "n": name (required, max 120)}] max 40,
      "st": [{"x": step text (required, max 600), "sec": timer seconds (int 1..86400)}] max 30,
      "nu": per serving estimate {"kcal" 0..10000, "pro", "carb", "fat" 0..2000 grams} (ints), "g": sender language "en" | "es" | "pt",
      "tr": the same recipe in OTHER languages (optional), {"en" | "es" | "pt": {"t", "d"?, "i": [{"q"?, "n"}], "st": [{"x"}]}}}
   "tr" versions carry words only, with the same caps and cleaning as the base. Numbers (m, s, nu and each
   step's "sec") live only in the base; a reader takes a step's timer from the base step at the same index.

   decodeRecipeLink(input) resolves to the cleaned recipe, in the same short keys, or null for a broken link:
     { v: 1, t, d?, m?, s?, i?: [{ q?, n }], st?: [{ x, sec? }], nu?: { kcal?, pro?, carb?, fat? }, g?,
       tr?: { en?|es?|pt?: { t, d?, i?: [{ q?, n }], st?: [{ x }] } } }
   Optional keys are left out when missing, empty or out of range ("i" and "st" are left out when empty).
   Cleaning: control characters (C0, DEL, C1) and bidi override characters (U+202A..U+202E, U+2066..U+2069)
   are removed, strings are trimmed and cut to the caps (never splitting an emoji's surrogate pair), empty
   items are dropped before the list caps apply, numbers must be whole and in range or they are ignored.
   A "tr" version is kept only when, after cleaning, it has a title and its "i" and "st" have exactly as many
   items as the base's (so every step lines up with its timer); a version in the base's own language ("g")
   is dropped, since the base already is that language. "tr" is left out when no version is kept.
   Broken (null): bad prefix, bad base64, bad deflate, bad UTF-8, bad JSON, no title, or no ingredients and no steps.
   recipeForLanguage(recipe, lang) gives the recipe to show a reader of that language (see below).
   Show the result as plain text only (textContent), never as HTML or links. */

const MAX_PAYLOAD_CHARS = 100000; // real links stay under 6000 characters
const MAX_JSON_BYTES = 262144; // a real recipe inflates to a few KB; stop anything bigger

export const RECIPE_LIMITS = Object.freeze({
  title: 120, description: 300, amount: 40, name: 120, step: 600,
  ingredients: 40, steps: 30,
  minutes: [1, 1440], servings: [1, 50], timer: [1, 86400],
  nutrition: Object.freeze({ kcal: [0, 10000], pro: [0, 2000], carb: [0, 2000], fat: [0, 2000] }), // same as the app
});
const LANGS = ['en', 'es', 'pt'];
const STRIP = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const PAYLOAD = /^[01]\.[A-Za-z0-9_-]+$/;

/** The "1.<data>" (or "0.<data>") part of a link, fragment or bare payload, or null. */
export function extractPayload(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  const hash = s.indexOf('#');
  if (hash >= 0) {
    s = s.slice(hash + 1);
  } else {
    const q = s.indexOf('?');
    if (q >= 0) {
      const d = s.slice(q + 1).split('&').find((part) => part.startsWith('d='));
      if (d === undefined) return null;
      try { s = decodeURIComponent(d.slice(2)); } catch (e) { return null; }
    }
  }
  s = s.trim();
  if (s.length > MAX_PAYLOAD_CHARS || !PAYLOAD.test(s)) return null;
  return s;
}

function fromBase64Url(s) {
  if (s.length % 4 === 1) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  let bin;
  try { bin = atob(b64); } catch (e) { return null; }
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return out;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') return null;
  let reader;
  try {
    reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  } catch (e) { return null; } // this browser has no raw deflate
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_JSON_BYTES) { reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
  } catch (e) { return null; } // truncated or not deflate
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  let s = value.replace(STRIP, '').trim();
  if (s.length > max) {
    s = s.slice(0, max);
    const last = s.charCodeAt(s.length - 1);
    if (last >= 0xD800 && last <= 0xDBFF) s = s.slice(0, -1); // don't cut an emoji in half
    s = s.trim();
  }
  return s;
}

function wholeIn(value, [lo, hi]) {
  return typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi ? value : undefined;
}

function cleanList(value, max, cleanItem) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (out.length >= max) break;
    const clean = cleanItem(item);
    if (clean) out.push(clean);
  }
  return out;
}

function cleanIngredients(value) {
  const L = RECIPE_LIMITS;
  return cleanList(value, L.ingredients, (item) => {
    if (!isObject(item)) return null;
    const n = cleanText(item.n, L.name);
    if (!n) return null;
    const q = cleanText(item.q, L.amount);
    return q ? { q, n } : { n };
  });
}

/** Steps with their timers (base), or words only (withTimers false, for a "tr" version). */
function cleanSteps(value, withTimers) {
  const L = RECIPE_LIMITS;
  return cleanList(value, L.steps, (step) => {
    if (!isObject(step)) return null;
    const x = cleanText(step.x, L.step);
    if (!x) return null;
    const sec = withTimers ? wholeIn(step.sec, L.timer) : undefined;
    return sec === undefined ? { x } : { x, sec };
  });
}

/** The "tr" versions that line up with the cleaned base (see the header), or undefined when none do. */
function cleanVersions(raw, base, iCount, stCount) {
  if (!isObject(raw)) return undefined;
  const L = RECIPE_LIMITS;
  const out = {};
  for (const lang of LANGS) {
    if (lang === base.g || !isObject(raw[lang])) continue;
    const version = raw[lang];
    const t = cleanText(version.t, L.title);
    if (!t) continue;
    const i = cleanIngredients(version.i);
    const st = cleanSteps(version.st, false);
    if (i.length !== iCount || st.length !== stCount) continue; // doesn't line up with the base: dropped
    const clean = { t };
    const d = cleanText(version.d, L.description);
    if (d) clean.d = d;
    if (i.length) clean.i = i;
    if (st.length) clean.st = st;
    out[lang] = clean;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Cleans a parsed recipe object (see the header). Null when it has no title or nothing to cook from. */
export function cleanRecipe(raw) {
  if (!isObject(raw)) return null;
  const L = RECIPE_LIMITS;
  const t = cleanText(raw.t, L.title);
  if (!t) return null;
  const i = cleanIngredients(raw.i);
  const st = cleanSteps(raw.st, true);
  if (!i.length && !st.length) return null;

  const out = { v: 1, t };
  const d = cleanText(raw.d, L.description);
  if (d) out.d = d;
  const m = wholeIn(raw.m, L.minutes);
  if (m !== undefined) out.m = m;
  const s = wholeIn(raw.s, L.servings);
  if (s !== undefined) out.s = s;
  if (i.length) out.i = i;
  if (st.length) out.st = st;
  if (isObject(raw.nu)) {
    const nu = {};
    for (const key of ['kcal', 'pro', 'carb', 'fat']) {
      const n = wholeIn(raw.nu[key], L.nutrition[key]);
      if (n !== undefined) nu[key] = n;
    }
    if (Object.keys(nu).length) out.nu = nu;
  }
  if (LANGS.includes(raw.g)) out.g = raw.g;
  const tr = cleanVersions(raw.tr, out, i.length, st.length);
  if (tr) out.tr = tr;
  return out;
}

/** The recipe to show a reader of `lang` ("en" | "es" | "pt"), in the same short keys and without "tr":
    the link's version in that language when it has one (words from the version, every number from the
    base, each step's timer from the base step at the same index, "g" set to `lang`), otherwise the base
    as sent (its "g" is the sender's language, or missing when unknown). Null for null. */
export function recipeForLanguage(recipe, lang) {
  if (!isObject(recipe)) return null;
  const { tr, ...base } = recipe;
  const version = isObject(tr) && lang !== base.g ? tr[lang] : undefined;
  if (!isObject(version)) return base;
  const out = { v: 1, t: version.t };
  if (version.d) out.d = version.d;
  if (base.m !== undefined) out.m = base.m;
  if (base.s !== undefined) out.s = base.s;
  if (version.i) out.i = version.i.map((item) => ({ ...item }));
  if (version.st) {
    out.st = version.st.map((step, k) => {
      const sec = base.st && base.st[k] ? base.st[k].sec : undefined;
      return sec === undefined ? { x: step.x } : { x: step.x, sec };
    });
  }
  if (base.nu) out.nu = { ...base.nu };
  out.g = lang;
  return out;
}

/** Resolves to the cleaned recipe from a shared link (or its "#" part, or the bare payload), or null. */
export async function decodeRecipeLink(fragmentOrPayload) {
  try {
    const payload = extractPayload(fragmentOrPayload);
    if (!payload) return null;
    let bytes = fromBase64Url(payload.slice(2));
    if (!bytes || !bytes.length) return null;
    if (payload[0] === '1') bytes = await inflateRaw(bytes);
    if (!bytes || bytes.length > MAX_JSON_BYTES) return null;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return cleanRecipe(JSON.parse(text));
  } catch (e) {
    return null; // bad UTF-8 or bad JSON
  }
}
