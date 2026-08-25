# portfolio

Personal portfolio site for Francis Wilfred Antiporda, covering the five
projects in this repository.

**Stack:** static HTML, CSS and JavaScript. No build step, no bundler, no
package manager, the same as `bike-guide-app` and
`corruption-reporting-system-final`.

## Running it

```bash
cd portfolio
python3 -m http.server 8090   # then open http://localhost:8090
```

A plain static server is enough. Nothing here needs Node.

## Layout

```
portfolio/
├── index.html              # hero, about, skills, projects, timeline, contact
├── resume.html             # printable résumé (Print, then Save as PDF)
├── 404.html                # served by Vercel on a bad path
├── projects/               # one case-study page per project
│   ├── autocare.html
│   ├── rallyready.html
│   ├── cyclemind-ai.html
│   ├── bike-guide-ph.html
│   └── corruption-watch-ph.html
├── css/style.css           # every style, one file, custom properties at the top
├── js/
│   ├── boot.js             # adds .js to <html> before paint (see the CSP note)
│   ├── site.js             # terminal, filters, copy, counters, reveal, progress
│   └── notfound.js         # shows the path that 404'd
├── assets/img/             # portrait, avatar, OG image, project screenshots
├── robots.txt
├── sitemap.xml
└── vercel.json             # clean URLs, cache headers, CSP
```

## Interactive bits

- **The hero terminal actually works.** After the intro types itself out the
  prompt becomes a real input. It understands `help`, `whoami`, `ls`,
  `open <project>`, `skills`, `education`, `contact`, `resume`, `github`,
  `clear` and `sudo`. Tab completes commands and project names, and the arrow
  keys walk back through history. Commands live in the `PROJECTS` and
  `COMMANDS` objects near the top of `site.js`, so adding one is a two-line
  change.
- **Project filtering.** The chips above the project list filter by stack,
  driven by the `data-tech` attribute on each `.card`. Add a tech to a card and
  a chip with the same `data-filter` value and it works.
- **Copy buttons.** Any element with `data-copy="..."` copies that text and
  shows confirmation for a moment.
- **Reading progress and back to top.** The bar appears on case-study pages,
  the button after 600px of scroll.
- **Light and dark themes.** Dark is the default and the identity. The toggle in
  the nav writes `data-theme` on `<html>` and remembers the choice in
  `localStorage`; `boot.js` reapplies it before the first paint so there is no
  flash. With no stored choice the system preference wins. The terminal window
  stays dark in both themes, the way an embedded editor does, which works
  because `.term` redefines the colour tokens on itself and everything inside
  inherits them.

## Things worth knowing before editing

- **Everything is progressive enhancement.** Every word on the page is in the
  HTML. `site.js` only animates and rearranges what is already there, so the
  site reads fine with JavaScript off or broken. The terminal falls back to a
  static block of text.
- **No inline `<script>` or `style` attributes, on purpose.** The
  Content-Security-Policy in `vercel.json` forbids both, which is why the
  one-line `boot.js` exists instead of an inline script in `<head>`. Add an
  inline script or a `style="..."` attribute and it will be blocked in
  production. Put it in `site.js` or `style.css` instead.
- **No em dashes in the prose.** House style for this site. Use commas, colons
  or a full stop. Check with `grep -rn "—\|–" portfolio/`, which should print
  nothing.
- **Colours come from tokens, never literals.** Every colour lives in the
  custom properties at the top of `style.css`, which is what makes the light
  theme a block of overrides rather than a rewrite. A hard-coded hex in a rule
  will look wrong in one of the two themes.
- **Contrast is checked, not assumed.** Body and secondary text clear 4.5:1 in
  both themes. If you darken `--faint` or `--dim`, re-check them.
- **The screenshots are composites**, generated from the running apps at
  1200x750 on the site's own background so all five cards match. They live in
  `assets/img/shot-*.jpg`. To regenerate one, screenshot the app and paste it
  onto a `#0b0e0b` canvas at that size.
- **`cyclemind_ai` has no screenshot.** There is no Flutter SDK in the
  development environment, so its card shows a stylised placeholder rather than
  a mock-up of a screen nobody ran. Drop in a real screenshot and swap the
  `.card-shot.is-empty` block for an `<img>` when one exists.
- **Fonts come from Google Fonts.** Both faces have real fallbacks
  (`ui-monospace` and `system-ui`), so a blocked CDN changes the typography but
  not the layout.
- **The timeline hashes are real.** They are the first commit touching each
  project directory. If you rewrite history, regenerate them with
  `git log --reverse --format='%h %as' -- <dir> | head -1`.

## Deploying to Vercel

The project is linked to this repository. **Root Directory** must be
`portfolio`, framework preset **Other**, with no build command and no output
directory. Vercel serves the folder as-is and reads `vercel.json` for headers
and clean URLs.

The canonical URL, `robots.txt` and `sitemap.xml` all reference
`https://wilfred-website.vercel.app`. If the Vercel project gets renamed,
update those three places to match.

## CI

`.github/workflows/static-sites-ci.yml` parses every JavaScript file and inline
`<script>` block in this folder on each push and pull request. It catches
syntax errors, not behaviour.
