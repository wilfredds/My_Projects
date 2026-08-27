#!/usr/bin/env node
// Link check for the static sites.
//
// Two failure modes this catches, both of which have actually happened:
//
//   1. A relative href pointing at a file that is not there, usually after a
//      page is renamed or moved.
//   2. An in-page "#anchor" with no element of that id on the page, which
//      fails silently in a browser: the click just does nothing.
//
// External URLs are NOT checked. They need the network, they go stale on
// somebody else's schedule, and a CI job that fails because a third party is
// down teaches everyone to ignore CI. Verify those by hand against the source
// of truth (for Vercel domains, that is the project's domain list).
//
// Dependency-free, Node stdlib only.
//
// Usage: node .github/scripts/check-links.mjs <dir> [dir...]

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('usage: check-links.mjs <dir> [dir...]');
  process.exit(2);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Every href and src in the document, with the raw attribute value. */
function links(html) {
  const found = [];
  const re = /(?:href|src)\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) found.push(m[1]);
  return found;
}

/** ids and name anchors declared on the page. */
function anchors(html) {
  const ids = new Set();
  const re = /\bid\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return ids;
}

let checked = 0;
const problems = [];

for (const root of roots) {
  const pages = walk(root);

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const ids = anchors(html);

    for (const raw of links(html)) {
      const href = raw.trim();

      // Not ours to check: absolute URLs, data/mailto/tel, empty, templating.
      if (!href) continue;
      if (/^(https?:|data:|mailto:|tel:|javascript:|#$)/i.test(href)) continue;

      // Inline scripts build markup with template literals. "${article.url}"
      // is not a link, it is a placeholder.
      if (href.includes('${')) continue;

      checked += 1;

      const [pathPart, hash] = href.split('#');

      // A bare "#id" points at this same page.
      if (pathPart === '') {
        if (hash && !ids.has(hash)) {
          problems.push(`${page}: "#${hash}" has no element with that id`);
        }
        continue;
      }

      // Resolve against the page for relative links, against the root for
      // site-absolute ones, the way the host serves them.
      const base = pathPart.startsWith('/') ? root : dirname(page);
      const target = resolve(base, pathPart.replace(/^\//, ''));

      // Vercel's cleanUrls means "/resume" is served from "resume.html".
      const candidates = [target, `${target}.html`, join(target, 'index.html')];
      const hit = candidates.find((c) => existsSync(c));

      if (!hit) {
        problems.push(`${page}: "${href}" does not resolve to a file`);
        continue;
      }

      // Check the fragment against the page it actually lands on.
      if (hash && hit.endsWith('.html')) {
        const targetIds = anchors(readFileSync(hit, 'utf8'));
        if (!targetIds.has(hash)) {
          problems.push(
            `${page}: "${href}" lands on ${relative('.', hit)}, which has no id "${hash}"`,
          );
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} broken link(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`  ${checked} internal links resolve cleanly`);
