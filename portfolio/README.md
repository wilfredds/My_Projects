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
│   ├── hiroshi-master-grill.html
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

## Motion

Three rules, all enforced in `style.css` under the Motion heading.

1. Nothing animated is load-bearing. Every element is readable in its finished
   state, and `prefers-reduced-motion` turns all of it off.
2. Only `transform` and `opacity` animate, so nothing triggers layout.
3. Reveals stagger **by arrival, not by position**. A row of cards scrolled
   into view together cascades; a single card arriving alone appears with no
   delay. `site.js` sets `--d` on each element in the observer batch, and the
   `.reveal.in` shorthand reads it. That delay has to live inside the
   shorthand: setting `transition-delay` in a separate, less specific rule
   loses the cascade and the stagger silently does nothing.

The portrait parallax runs only on a fine pointer, so it never fights a touch
scroll. The theme toggle adds `.theme-switching` for 320ms so colours fade
rather than snap, then removes it.

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
- **External URLs are not checked by CI.** The source of truth for a Vercel
  domain is the project's own domain list. One trap when reading it: while a
  deployment is `QUEUED` or `BUILDING`, that list shows only the long
  `*-<team>.vercel.app` domains and **omits the short aliases**, which makes a
  perfectly good URL look dead. Always read the list against a deployment whose
  `readyState` is `READY`, or the check is worthless.
- **Two live links depend on the repository name.** The CycleMind AI and Bike
  Guide demos are served by GitHub Pages from the `gh-pages` branch, at
  `wilfredds.github.io/My_Projects/` and `.../bike-guide-app/`. Renaming the
  repository changes those paths. It has already broken once: `deploy-web.yml`
  hardcoded the old name in `--base-href`, so after the rename every asset in
  the published Flutter app resolved to a path that no longer existed and the
  demo loaded to a blank page. The workflow now reads the name off the event,
  but the two hrefs here are still plain text. Check them after any rename.
- **Section headings are an eyebrow and a sentence, not a shell command.**
  Every section on every page opens the same way: a small uppercase mono
  eyebrow in `--amber` naming the section, then a Fraunces heading in
  `--green` that says something. On the home page that pairing is
  `.section-head`; on the case-study pages it is `.detail-head`. Both draw the
  eyebrow from the same standalone `.eyebrow` rule. The earlier design wrote
  these as `$ cat problem.md`, which read as a command nobody could run and
  told a recruiter nothing about the section underneath. If you add a section,
  write the heading as a claim, not a filename.
- **Colours come from tokens, never literals.** Every colour lives in the
  custom properties at the top of `style.css`, which is what makes the light
  theme a block of overrides rather than a rewrite. A hard-coded hex in a rule
  will look wrong in one of the two themes.
- **Contrast is checked, not assumed.** Body and secondary text clear 4.5:1 in
  both themes. If you darken `--faint` or `--dim`, re-check them.
- **The screenshots are composites**, generated from the running apps at
  1200x750 on the site's own background so all six cards match. They live in
  `assets/img/shot-*.jpg`. To regenerate one, screenshot the app and paste it
  onto a `#0C0E0B` canvas at that size. That value is measured off the existing
  files, not guessed; the README used to say `#0b0e0b`, which is close but not
  what is actually in them.
- **The project card screenshots carry `alt=""` on purpose.** Each sits inside
  an `aria-hidden="true"` wrapper with `tabindex="-1"`, because the link is a
  duplicate of the Case study button and the card's own heading and paragraph
  already say what the project is. A screen reader that met both would hear
  the same project twice. Describing the image there does not help either:
  text inside `aria-hidden` is never announced, so a long `alt` on those is
  dead weight that only looks conscientious. The real description belongs on
  the `<figure>` in the case study, which is not hidden. One of these drifted
  out of line once, so the rule is written down here rather than left to be
  noticed.
- **`cyclemind_ai` is screenshotted from its own published build.** There is no
  Flutter SDK here, so the app cannot be built locally, but the `gh-pages`
  branch already holds the web build its workflow published. Serving that branch
  locally runs the real app, which is where `shot-cyclemind.jpg` comes from.
  Four things are needed to make it render offline, and all four are
  local-only: the branch is never modified.

  1. Serve it at the path its `<base href>` expects (`/My_Projects/`), or every
     asset 404s.
  2. Point CanvasKit at the copy in the build: add
     `config: { canvasKitBaseUrl: "canvaskit/" }` to the `_flutter.loader.load`
     call in `flutter_bootstrap.js`. Otherwise it fetches CanvasKit from
     gstatic and nothing paints at all.
  3. Give the browser `locale="en-US"`, or Dart throws
     `Incorrect locale information provided` before the first frame.
  4. Let the Roboto request through. CanvasKit draws no text without it, so a
     blocked font gives you a screenshot of a UI with every label missing, and
     it looks like a layout bug rather than a network one.

  Click through it with Flutter's semantics tree rather than pixel
  coordinates: `document.querySelector('flt-semantics-placeholder').click()`
  turns `flt-semantics` nodes into real DOM with `aria-label`s, so controls can
  be found by name. Move the pointer off a nav item before capturing, or
  Material's tooltip fades in and lands in the shot.
- **The certificates are scans of the real documents.** `assets/img/certs/*.jpg`
  is rendered from the issuer's own PDF, longest side 1800px, JPEG quality 85.
  To add one, render page 1 of the PDF and add a `.cert` entry in `index.html`.
  The card carries `data-cert-src`, `data-cert-title` and `data-cert-note`, and
  `site.js` fills the single `#lightbox` overlay from whichever button was
  clicked, so no JavaScript changes when a certificate is added.
- **The AWS badge is artwork, not a scan.** `cert-aws.png` is the issuer's own
  PNG, transparent and square, where the other five are rendered pages. It
  carries `class="is-badge"`, which drops the paper shadow and corner radius:
  both trace the image's square bounds rather than the shield, and on a badge
  that reads as a bug. Every other certificate rule applies to it unchanged.
- **Never draw a credential.** If a badge or certificate has not been supplied,
  the card shows `.cert-shot.is-empty` and says so. Recreating one from memory,
  or from having seen it once, would put a picture on the site that no issuer
  ever produced. Wait for the file.
- **Certificate images stay out of the crop.** They are documents, so
  `.cert-shot img` uses `object-fit: contain` against the `--cert-mat` token
  rather than `cover`. Cropping a certificate cuts off the text that makes it
  worth showing.
- **Three faces, three jobs.** Fraunces carries the voice (the headline and
  every section heading), IBM Plex Sans the prose, IBM Plex Mono every
  measurement, label and directory name. Keeping numbers in one face is what
  lets the ledger column line up. All three come from Google Fonts and all
  three have real fallbacks, so a blocked CDN changes the typography but not
  the layout.
- **The ledger is measured, never copied.** The figures under "What the demo
  does not show" are the point of the page, so a wrong one costs more than a
  missing one. Re-derive them by running the suites, not by reading this file:

  ```bash
  (cd autocare && npm test && npm run test:db)   # 11 + 34
  (cd rallyready && npm test)                    # 641
  (cd hiroshi-grill && npm test)                 # 132
  (cd hiroshi-grill && npm run db:test)          # 43 RLS policies
  (cd flare && npm test)                         # 97
  (cd firestore-tests && npm test)               # 25 + 35 + 63 + 21 = 144
  ```

  They have drifted three times already. The total is the sum of all of them.
  Note that each rules suite belongs to one project: Corruption Watch's own
  figure is 25, not the 144 total, and the site says 25 on that card.
- **The favicon is an inline SVG, so it cannot use Fraunces.** A data-URI SVG
  rendered as an icon resolves fonts against the system, not the page, so the
  monogram is set in Arial with a Helvetica and generic-sans fallback. It was
  chosen by rendering the candidates at 16px rather than by eye at full size:
  a serif's thin strokes disappear at that size, and a teal ground with dark
  letters reads as a bright blob. Bold sans on the ink ground survives. If you
  change it, render it at 16 against both a light and a dark browser chrome
  before deciding.
- **The portrait does not move.** It used to drift and scale on scroll. The
  scale escaped its container once the caption moved out from over the
  photograph, and a moving portrait fought the stillness the rest of the page
  depends on, so the parallax was removed rather than patched.
- **The timeline hashes are real.** They are the first commit touching each
  project directory. If you rewrite history, regenerate them with
  `git log --reverse --format='%h %as' -- <dir> | head -1`.

## The résumé PDF

`assets/francis-wilfred-antiporda-cv.pdf` is **generated from `resume.html`**, not
maintained separately. That is deliberate: one source of truth means the PDF and
the page cannot drift apart, which is exactly how the old CV ended up describing
AutoCare with the wrong stack and linking to a dead portfolio URL.

Regenerate it after editing `resume.html`:

```bash
cd portfolio && python3 -m http.server 8090 &
# then, with Playwright available:
#   page.goto('http://localhost:8090/resume.html')
#   page.emulate_media(media='print')
#   page.pdf(path='assets/francis-wilfred-antiporda-cv.pdf', format='A4',
#            margin={'top':'13mm','bottom':'13mm','left':'14mm','right':'14mm'})
```

Or simply open `/resume` and use the browser's Print, then Save as PDF. The
print stylesheet at the bottom of `style.css` is tuned so the result lands on
two A4 pages; if you add a project or a certification, check it still does.

Two things in that block exist only to hold those two pages, so do not "tidy"
them away: the certifications list is set in two columns (`.cv-certs`), and
`.cv-skills` is deliberately allowed to break across pages. Held together it is
one block too tall for whatever is left of page two, so it gets pushed whole
onto a third page. Its rows keep `break-inside: avoid` individually.

## Deploying to Vercel

The project is linked to this repository. **Root Directory** must be
`portfolio`, framework preset **Other**, with no build command and no output
directory. Vercel serves the folder as-is and reads `vercel.json` for headers
and clean URLs.

The canonical URL, `robots.txt` and `sitemap.xml` all reference
`https://wilfred-website.vercel.app`. If the Vercel project gets renamed,
update those three places to match.

### The project only builds when this folder changes

`ignoreCommand` in `vercel.json` is Vercel's Ignored Build Step. **Exit 0
skips the build, any other code runs it.** It lives in the repo rather than
in the dashboard so it is reviewable and travels with the code.

This is a monorepo of eight unrelated projects wired to one Vercel project,
so every push to any branch was starting a build here. This stops the builds
that have nothing to say about the portfolio.

**What it does not fix, despite an earlier claim here that it did.** Vercel
reads `vercel.json` from the Root Directory, which is `portfolio`. On a
branch that has no `portfolio/` directory, there is no `vercel.json` to
read, so `ignoreCommand` never runs. Those deployments fail earlier, at
`The specified Root Directory "portfolio" does not exist`, and the build
log carries no `Running "git cat-file ..."` line at all. That covers
`gh-pages` and any branch cut before the portfolio existed, which is every
failing deployment. Testing the command against those branches locally
says nothing about this, because the command is never reached.

So `ignoreCommand` skips pointless *successful* builds, which is real but
smaller: a push to `main` touching only `autocare/` no longer rebuilds the
site. Silencing the *failed* ones needs a project-level setting, since it
has to apply to branches whose files Vercel cannot consult. That is
**Settings, Git, Ignored Build Step** in the dashboard, which stores the
command against the project rather than the branch. Confirm it with the
next push to `gh-pages`: a build log that shows the command running, or no
deployment at all, means it took.

```sh
git cat-file -e HEAD:portfolio 2>/dev/null || exit 0
git rev-parse --verify -q HEAD^ >/dev/null 2>&1 || exit 1
git diff --quiet HEAD^ HEAD -- ':/portfolio'
```

Three lines because two edge cases bite:

- **`gh-pages` is an orphan branch with no parent commit.** The usual
  recipe, `git diff --quiet HEAD^ HEAD ./`, fails there with `bad revision`
  and exits 128, which Vercel reads as "build it". The first line asks
  whether the commit contains a `portfolio/` tree at all instead, so the
  command is correct wherever it does run. Note the caveat above: on
  `gh-pages` it does not run.
- **A commit with no parent could be a shallow clone**, where the answer is
  genuinely unknown. The second line builds rather than skips, because
  skipping wrongly means the site silently stops updating and skipping is
  the failure you would not notice.

The `:/portfolio` pathspec is anchored to the repository root, so the
command gives the same answer whether it runs from the repo root or from
the Root Directory. That was verified from both, against real commits on
`main`, `gh-pages` and a project branch, rather than assumed: an ordinary
`./` or `-- portfolio/` would be wrong in one of the two and, in one
direction, would skip every build forever.

When a build is skipped the previous deployment stays live, which is
correct: the portfolio did not change, so neither should the site.

## CI

`.github/workflows/static-sites-ci.yml` runs two checks over this folder on
every push and pull request:

- **`check-static-js.mjs`** parses every JavaScript file and inline `<script>`
  block. Syntax only, not behaviour.
- **`check-links.mjs`** resolves every relative link and in-page `#anchor`,
  including through Vercel's clean URLs. External URLs are deliberately not
  checked: they need the network and fail on somebody else's schedule.

