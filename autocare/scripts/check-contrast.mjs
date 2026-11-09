#!/usr/bin/env node
/**
 * Measure every colour pairing the theme relies on against WCAG 2.1 AA.
 *
 *   node scripts/check-contrast.mjs
 *
 * Reads the `:root` tokens straight out of app/globals.css, so it always
 * checks what actually ships. Exits 1 if any pair falls short:
 *   - text: 4.5:1 (body text here is 18px, which is NOT "large" under WCAG
 *     unless bold at 18.66px+, so the stricter ratio applies everywhere)
 *   - edges and focus rings: 3:1 (WCAG 1.4.11, non-text contrast)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'app', 'globals.css'), 'utf8');

const root = css.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
if (!root) {
  console.error('Could not find the :root block in app/globals.css');
  process.exit(1);
}

/** `--name: 17 88% 40%;` → { name: [17, 88, 40] } */
const tokens = {};
for (const [, name, h, s, l] of root[1].matchAll(
  /--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g,
)) {
  tokens[name] = [Number(h), Number(s), Number(l)];
}
tokens.white = [0, 0, 100];

function hslToRgb([h, s, l]) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [la, lb] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

const TEXT = 4.5;
const EDGE = 3;

/** [foreground token, background token, minimum, where it is used] */
const pairs = [
  ['foreground', 'background', TEXT, 'body text on the page'],
  ['foreground', 'card', TEXT, 'body text on cards'],
  ['foreground', 'accent', TEXT, 'text on a hovered row'],
  ['foreground', 'primary-tint', TEXT, 'text on a chosen option'],
  ['muted-foreground', 'background', TEXT, 'secondary text on the page'],
  ['muted-foreground', 'card', TEXT, 'secondary text on cards'],
  ['muted-foreground', 'muted', TEXT, 'muted badge'],
  ['muted-foreground', 'accent', TEXT, 'secondary text on a hovered row'],
  ['primary-foreground', 'primary', TEXT, 'orange button label'],
  ['primary-foreground', 'primary-strong', TEXT, 'orange button label, hovered'],
  ['primary', 'card', TEXT, 'orange text on white'],
  ['primary', 'background', TEXT, 'orange text on the page'],
  ['primary-strong', 'card', TEXT, 'links and small orange text'],
  ['primary-strong', 'background', TEXT, 'links on the page'],
  ['primary-strong', 'primary-tint', TEXT, 'tick on a chosen option'],
  ['success', 'success-tint', TEXT, '"paid" badge'],
  ['destructive', 'destructive-tint', TEXT, '"unpaid" badge, error box'],
  ['warning', 'warning-tint', TEXT, '"partly paid" badge, warning box'],
  ['destructive', 'card', TEXT, 'money still owed, delete button'],
  ['destructive', 'background', TEXT, 'money still owed on the page'],
  ['destructive-foreground', 'destructive', TEXT, '"yes, delete" button'],
  ['card', 'foreground', TEXT, 'white on ink (numbered rules, ticks)'],
  ['white', 'meter-window', TEXT, 'meter digits'],
  ['white', 'meter', TEXT, 'meter detail figures'],
  ['meter-label', 'meter-window', TEXT, 'meter label'],
  ['meter-label', 'meter', TEXT, 'meter detail labels'],
  ['meter-accent', 'meter-window', TEXT, 'peso sign in the meter'],
  ['input', 'card', EDGE, 'field and button edges on cards'],
  ['input', 'background', EDGE, 'field and button edges on the page'],
  ['ring', 'card', EDGE, 'focus ring on cards'],
  ['ring', 'background', EDGE, 'focus ring on the page'],
  ['primary', 'background', EDGE, 'orange button against the page'],
];

let failed = 0;
const rows = [];
for (const [fg, bg, min, use] of pairs) {
  if (!tokens[fg] || !tokens[bg]) {
    console.error(`Missing token: --${tokens[fg] ? bg : fg}`);
    failed++;
    continue;
  }
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  rows.push(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (needs ${min}:1)  ${fg} on ${bg} — ${use}`);
}

console.log(rows.join('\n'));
console.log(failed ? `\n${failed} pairing(s) below WCAG AA.` : `\nAll ${pairs.length} pairings meet WCAG AA.`);
process.exit(failed ? 1 : 0);
