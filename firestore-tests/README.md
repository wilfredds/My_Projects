# Firestore rules tests

Tests for the security rules of the three Firebase projects:

- `../corruption-reporting-system-final/firestore.rules`
- `../bike-guide-app/firestore.rules`
- `../flare/firestore.rules`

None of them needs this directory to run — it is optional tooling, kept out of
those projects so the static ones stay build-free.

## Running

Needs Node and a JDK (the Firestore emulator is a Java process).

```bash
cd firestore-tests
npm install
npm test
```

`npm test` boots the emulator, loads each rules file, exercises it as an
anonymous visitor, a signed-in non-admin and an admin, then shuts down.

Run one suite at a time with `npm run test:corruption`,
`npm run test:bikeguide` or `npm run test:flare`.

## In CI

`.github/workflows/firestore-rules-ci.yml` runs both suites on every push to
`main` and every pull request that touches either `firestore.rules` or this
directory. It boots the same emulator CI-side, so what the workflow checks is
what Firebase will actually enforce.

The workflow was verified to fail, not just to pass: temporarily loosening
`users/{userId}/rides` to `allow read: if true` turned five denial assertions
red and exited non-zero. A suite that cannot go red guards nothing.

`flare.test.mjs` was verified the same way. Loosening the user-update rule to
`allow update: if isAdmin() || isOwner(userId)` turned exactly the five
privilege-escalation assertions red and nothing else — the escalation attempts
run as their own throwaway accounts (`mallory-*`) precisely so a broken rule
fails its own assertion instead of promoting the account every later assertion
depends on, which would bury the real failure under a cascade.

## Why bother

These rules are the only thing standing between the public internet and the
data — the Firebase web API keys in both projects are public identifiers, not
secrets. A rules file is easy to loosen by accident and the failure is silent:
nothing errors, data just becomes readable. The tests assert the negative cases
(*this must be denied*) that manual clicking never covers.

Current coverage:

| Suite | Assertions |
|---|---|
| `corruption.test.mjs` | 25 |
| `bikeguide.test.mjs` | 35 |
| `flare.test.mjs` | 63 |

## Adding a rule

Add the denial test first — a rule with no failing test proves nothing. Both
files use a tiny `check(name, fn)` helper wrapping `assertSucceeds` /
`assertFails`, so a new case is one call.
