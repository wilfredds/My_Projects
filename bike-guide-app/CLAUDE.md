# Bike Guide PH — working notes

A cycling companion PWA for Filipino beginner-to-intermediate riders: gear
shifting guidance, Philippine routes, ride tracking and a 30-day challenge.

**Stack:** static HTML/CSS/JS, no build step, no package manager. Installable
PWA (`manifest.json` + `sw.js`). Firebase loaded from CDN.

## Commands

None — no `package.json`, no bundler, no tests, no CI. Serve the folder:

```bash
python3 -m http.server 8000
```

Use a real server rather than `file://`: the service worker will not register
and ES module imports fail otherwise.

## Layout

Multi-page, one HTML file per feature — no router, no framework:

`index.html` `dashboard.html` `tracker.html` `record.html` `routes.html`
`maintenance.html` `gear-guide.html` `knowledge.html` `safety.html`
`warmup.html` `diet.html` `carbon.html` `challenge.html` `motivation.html`
`premium.html` `offline.html`

`js/` (~1100 lines total) — `app.js`, `ui.js` (227 lines), `tracker.js`,
`recorder.js`, `routes.js`, `bike-doctor.js`, `gear-simulator.js`,
`carbon.js`, `challenge.js`, `premium.js`, `firebase-config.js`

Unlike the corruption reporting project, **these JS files have real content**.

## PWA specifics

- `sw.js` is the service worker; `offline.html` is the offline fallback.
- **Bump the cache name in `sw.js` when you change cached assets**, otherwise
  returning users keep the old files indefinitely. This is the single most
  common way to ship a change that appears not to work.
- Test in a browser with the service worker active, not just a hard reload.
  The vendored `webapp-testing` skill can drive Playwright against a local
  server for this.

## Firebase

`js/firebase-config.js` initialises Firebase from a CDN module. The web API key
is a public identifier, not a secret — `firestore.rules` is what protects data.

Collections in use: `users/{uid}` (profile), `users/{uid}/rides`,
`users/{uid}/challenge`, `premiumRequests`, `premiumUsers/{uid}` — where `uid`
is a Firebase Auth UID.

**Anonymous Authentication must be enabled** in the Firebase console
(Authentication → Sign-in method → Anonymous). Without it every Firestore call
fails, because the rules require `request.auth != null`.

### Identity: Firebase Anonymous Auth

`js/auth.js` owns identity. It signs in with **Firebase Anonymous
Authentication** — no email, no password, nothing the user sees — and exposes
`uid()`, a promise resolving to the Firebase Auth UID.

**Anything touching Firestore must `await uid()`.** Never read an identity from
localStorage. The UID is not known until sign-in resolves, which is why the data
functions are all async.

This replaced a model where a user was a `crypto.randomUUID()` in localStorage,
sent as part of the document path. The rules engine could not verify such a
value — a caller claimed whichever ID it liked — so ownership was unenforceable
and anyone who learned a UUID could read that user's rides. Ownership is now
checked server-side against `request.auth.uid`.

It also fixed a live bug: `tracker.js` used
`localStorage.getItem('bikeUserId') || 'anonymous'`, so any device without that
key read and wrote a single shared `anonymous` bucket, and those users saw each
other's rides.

### The migration bridge — this is temporary, delete it

Existing users have data under their old localStorage UUID. After signing in
they get a different UID, so their rides would be stranded.

A profile document at `users/{uid}` may claim one `legacyId`. The rules
(`claimsLegacy()`) grant that account read and delete on `users/{legacyId}/**`
and `premiumUsers/{legacyId}` — exactly what the one-time copy in
`migrateLegacyData()` needs, and nothing more. `legacyId` is **write-once**: the
update rule rejects any change, so a profile cannot be repointed from one victim
to the next.

It is not airtight. Someone who already knows a victim's old UUID can claim it.
That is strictly narrower than the previous model, where knowing the UUID gave
full access, but it is still a bridge and not a destination.

**Once the userbase has opened the app once, delete `claimsLegacy()` and every
`|| claimsLegacy(...)` clause from `firestore.rules`, plus the legacy branch in
`checkPremiumActivation()`.** Keeping it forever preserves a weakness that
exists only to rescue old data.

### What the rules enforce

- **ownership** — a user reads and writes only `users/{their own uid}/**`
- **no enumeration** — `list` denied on `users` and `premiumUsers`
- **premium cannot be self-granted** — `premiumUsers` is read-only to clients;
  only an admin flips `activated`
- **payment references are write-only** — `premiumRequests` accepts a create
  from a signed-in user, whose `deviceId` must equal their own UID, and denies
  every read
- writes are shape-checked; unknown collections denied

### Testing and deploying rules

Covered by 35 assertions in `../firestore-tests/bikeguide.test.mjs`, including
cross-user denial and the write-once `legacyId` guarantee:

```bash
cd ../firestore-tests && npm install && npm run test:bikeguide
```

Add a denial test before loosening a rule.

Deployment is manual. `firebase.json` points the CLI at `firestore.rules` and
`.firebaserc` pins the project to `bikeguide-ph`, so from this directory:

```bash
firebase login          # once, per machine
firebase deploy --only firestore:rules
```

**Enable Anonymous sign-in first** (console → Authentication → Sign-in method →
Anonymous). The rules require `request.auth != null`, so deploying them before
the provider is on breaks every Firestore call for every user.

Until the deploy is run, the rules in this repo are not the rules in production.

## Scope note

`premium.html` implies a paid tier. Payment is manual: the user submits a GCash
reference, and an admin flips `premiumUsers/{deviceId}.activated` from the
console. There is no payment-provider integration and no automated verification
that the reference is real.
