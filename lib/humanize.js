// Humanizer.
//
// Strips the characters and phrases that make text read like it was generated
// by a machine. The biggest tell is the em-dash, which no normal keyboard types,
// so it is the first thing to go. Curly quotes, en-dashes and the single-glyph
// ellipsis are replaced with the plain keys a person actually presses. A small
// set of overused phrases is softened into everyday wording.
//
// Always run this on text BEFORE it is placed into HTML or JSON, so structured
// data stays valid (straight quotes get escaped properly by JSON.stringify).

// Phrases people rarely type, mapped to plain wording. Order matters: longer
// phrases first.
const PHRASES = [
  [/\bIn today's fast-paced world,?\s*/gi, ''],
  [/\bIn conclusion,?\s*/gi, 'So '],
  [/\bIn summary,?\s*/gi, 'In short, '],
  [/\bIt is worth noting that\s*/gi, ''],
  [/\bIt's worth noting that\s*/gi, ''],
  [/\bIt is important to note that\s*/gi, ''],
  [/\bIt's important to note that\s*/gi, ''],
  [/\bMoreover,?\s*/gi, 'Also, '],
  [/\bFurthermore,?\s*/gi, 'And '],
  [/\bAdditionally,?\s*/gi, 'Also, '],
  [/\bWhen it comes to\b/gi, 'For'],
  [/\ba myriad of\b/gi, 'many'],
  [/\ba plethora of\b/gi, 'plenty of'],
  [/\bcutting-edge\b/gi, 'modern'],
  [/\bstate-of-the-art\b/gi, 'modern'],
  [/\bgame[- ]changer\b/gi, 'big help'],
  [/\bsupercharge\b/gi, 'speed up'],
  [/\beffortlessly\b/gi, 'easily'],
  [/\bseamlessly\b/gi, 'smoothly'],
  [/\bseamless\b/gi, 'smooth'],
  [/\brobust\b/gi, 'solid'],
  [/\bleverage\b/gi, 'use'],
  [/\butilize\b/gi, 'use'],
  [/\bdelve into\b/gi, 'look at'],
  [/\bdive into\b/gi, 'look at'],
  [/\bfacilitate\b/gi, 'help'],
  [/\bplethora\b/gi, 'plenty'],
  [/\bunlock the power of\b/gi, 'get the most from'],
  [/\bempower\b/gi, 'help'],
];

// Replace a single string. Safe to call on any plain-text field.
export function humanizeText(input) {
  if (typeof input !== 'string') return input;
  let s = input;

  // Dashes: the giveaway. Em-dash and en-dash become commas or hyphens.
  s = s.replace(/\s*\u2014\s*/g, ', '); // em-dash with spacing -> comma
  s = s.replace(/\u2014/g, ', '); // any stray em-dash
  s = s.replace(/\s*\u2013\s*/g, ' - '); // en-dash -> spaced hyphen
  s = s.replace(/\u2013/g, '-');

  // Quotes and ellipsis: use the keys on the keyboard.
  s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  s = s.replace(/\u2026/g, '...');

  // Non-breaking and odd spaces -> a normal space.
  s = s.replace(/[\u00A0\u2007\u202F\u2009\u200A\u2002\u2003]/g, ' ');

  // Soften the overused phrases.
  for (const [re, to] of PHRASES) s = s.replace(re, to);

  // Tidy: collapse the double spaces a replacement may leave, and fix a comma
  // that ended up right before a full stop.
  s = s.replace(/ {2,}/g, ' ');
  s = s.replace(/,\s*([.!?])/g, '$1');
  s = s.replace(/\s+,/g, ',');

  return s;
}

// Walk an object or array and humanize every string inside it.
export function humanizeDeep(value) {
  if (typeof value === 'string') return humanizeText(value);
  if (Array.isArray(value)) return value.map(humanizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = humanizeDeep(v);
    return out;
  }
  return value;
}

// Clean only the unicode tell-characters in an already-built HTML string. This
// is safe to run on rendered HTML and on JSON-LD blocks because none of these
// characters carry meaning in HTML, CSS, JSON or JavaScript. It does NOT touch
// double curly quotes inside the file beyond converting them to straight ones,
// which is why text should still be humanized before JSON.stringify where
// possible. Used by the one-time cleaner for already-published files.
export function humanizeRenderedHtml(html) {
  return html
    .replace(/\u2014/g, ', ')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2007\u202F\u2009\u200A]/g, ' ');
}
