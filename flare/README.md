# FLARE

A commissioned full-stack build: the front-end design already exists in
Figma (client-owned file), and this project is the backend + database layer
that turns it into a working site.

## Status

**Design not yet integrated.** The Figma file (`FLARE-ASSETS`, file key
`vAtxWbxhQ7OUtQ7qhhY73V`, target node `57:374`) is owned by the client's own
Figma account and has not been shared with the account this environment
authenticates as (`frncishub@gmail.com`). Until the file owner adds that
account with at least "can view" access under Figma's Share dialog, no page
in `src/app` reflects the real design — the sign-in and dashboard pages that
exist now are deliberately plain placeholders that exercise the auth flow,
not the visual design.

What's real and permanent already: the Firebase wiring, the session-cookie
auth flow, the Firestore security rules, the catalogue and progress data
layer, audit logging, and the theme system. Rebuilding the UI once the design
is accessible should not touch any of that.

`docs/DATA-MODEL.md` is the schema source of truth, including the ten open
questions still outstanding with the client.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4) — same major
  version as `hiroshi-grill` elsewhere in this monorepo.
- **Firebase Authentication** for identity, **Cloud Firestore** for data.
  There is deliberately no ORM here: Prisma (used by `autocare` and
  `hiroshi-grill`) only targets relational databases and has no Firestore
  connector, so talking to Firestore means using Firebase's own SDKs
  directly — `firebase` in the browser, `firebase-admin` on the server.

## Project structure

```
src/
  app/
    api/auth/session/route.ts       # ID token -> httpOnly session cookie
    api/progress/route.ts           # the lesson screen's Finished toggle
    api/preferences/theme/route.ts  # persists the Dark Mode choice
    sign-in/page.tsx                # placeholder screen, real auth flow
    dashboard/page.tsx              # placeholder protected page
  components/
    theme-toggle.tsx                # unstyled; mechanism, not design
  lib/
    firebase/  env.ts, client.ts, admin.ts
    auth/      session.ts           # session cookie create/verify
    users/     profile.ts           # profile reads + requireActiveUser()
    catalog/   queries.ts           # categories, lessons, sections, questions
    progress/  rollup.ts            # pure: derived category percentage
               store.ts             # server-only progress reads/writes
               request.ts           # endpoint body validation
               sections.ts          # which sections are self-reportable
    audit/     log.ts               # the record the Privacy Notice promises
    theme/     theme.ts             # three-state theme preference
    types.ts
tests/                              # node --test, no database needed
middleware.ts                       # redirects signed-out visitors
firestore.rules                     # the real access-control boundary
```

## Three rules the backend enforces

**Progress is written server-side only.** `firestore.rules` closes
`users/{uid}/progress` to every client. The design puts a manual Finished
toggle on all three lesson sections, assessment included — client-writable
progress would let a learner mark an assessment complete without taking it,
and certificates are issued from these records. Routing writes through
`/api/progress` also gives the audit log the completion events the Privacy
Notice promises. `markSelfReportedSection` cannot touch the assessment state:
its parameter type does not admit it.

**Assessment answers are unreachable from every client.** Firestore rules
gate whole documents, never fields, so a `correctAnswer` on a readable
question document is readable — whatever the UI shows. Keys live in
`answerKeys/`, denied to everyone including admins, and grading happens
server-side.

**A Firebase account is not authorization.** FLARE is restricted to BFP
personnel, so accounts wait at `status: 'pending'` until an administrator
activates them. Server paths use `requireActiveUser()` rather than treating a
valid session as sufficient.

**A Server Action is a public endpoint.** Being called only from a page that
already checked `requireAdmin()` protects nothing — the action compiles to its
own HTTP endpoint that anyone can invoke. Every admin mutation goes through
`withAdmin()` in `src/lib/admin/guard.ts`, which re-verifies. Admin writes also
use the Admin SDK, which bypasses Firestore rules entirely, so there is no
second line of defence behind that guard.

**Content identifiers are permanent.** A category or lesson id is a foreign
key: every learner's progress document keys its section states by those ids,
and certificates are issued against them. Renaming one would not error — it
would silently strand existing progress at a path nothing reads, and a
compliance report would then show trained personnel as never having started.
So ids are generated once from the title at creation (`slugify`) and a later
title edit changes the title only. There is no hard delete for the same
reason: unpublishing removes content from circulation while leaving the
records that reference it intact.

**Uploads go browser → Storage directly, so `storage.rules` is the whole
authorization decision.** A 500 MB training video cannot pass through a
serverless function (Vercel caps request bodies at a few megabytes), so no
server sits in the upload path. `storage.rules` therefore re-enforces
everything the browser checks — admin-only writes, an allowlist of content
types, size caps — and reads the uploader's Firestore user document so
Storage and Firestore agree on who an administrator is. 21 assertions cover
it against the real Storage emulator.

Two consequences worth knowing:

- The storage path is built from ids the server already trusts plus a
  generated file id. No part of it comes from the uploaded filename, which is
  kept as a label on the Firestore document — that is what makes a prefix
  rule meaningful and why `../../secret.pdf` is stored as an ordinary object.
- The browser needs a live **Firebase Auth** session to upload, not just
  FLARE's server session cookie. The two normally travel together, but if the
  Firebase session is cleared while the server cookie is still valid, uploads
  fail with 403 while the rest of the app keeps working.

**A pasted video link is rebuilt, not sanitised.** The embed URL ends up as an
`<iframe src>` inside a government training portal, so passing the author's
string through would let anyone with an authoring account frame arbitrary
content there. Only the provider and video id are extracted; the URL is
rebuilt from scratch, through `youtube-nocookie.com` and Vimeo's `dnt=1` —
FLARE's Privacy Notice enumerates what the platform collects and does not
disclose third-party advertising cookies being set on BFP personnel.

**Section content is Markdown, never HTML.** Authored text is rendered into
every firefighter's browser, so storing HTML would let an authoring account
inject script across the whole Bureau. Markdown keeps the stored value inert
text, converted through a controlled renderer at display time.

**An administrator cannot lock everyone out.** FLARE has no recovery path: if
the last active administrator suspends or demotes themselves, nobody can
approve an account or publish a lesson again without hand-editing Firestore in
the Firebase console. `src/lib/users/transitions.ts` refuses self-suspension,
self-demotion, and removing the last active administrator — and the count it
checks is re-read from Firestore at the moment of the change, not taken from
whatever the browser was showing.

## Running locally without a Firebase project

The Firebase emulators cover both Auth and Firestore, so nothing here needs a
real project or a service account key. `src/lib/firebase/admin.ts` skips
credentials entirely when the emulator host variables are set.

```bash
npm run emulators                    # terminal 1 — auth, firestore, storage
npm run seed                         # terminal 2 — BFP test accounts, 6 categories
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
FIREBASE_PROJECT_ID=flare-local \
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true npm run dev
```

`NEXT_PUBLIC_FIREBASE_USE_EMULATORS` is what points the *browser* SDK at the
emulators; the other variables only reach the server. Sign in as
`admin@bfp.gov.ph` / `flare-emulator`.

`npm run seed` also prints a session cookie, which is enough to read the admin
screens — but uploading needs a real Firebase Auth session, so sign in through
the form for anything touching Storage.

Seeded accounts cover every state the admin surface handles: an active
administrator, an active learner, a pending applicant and a suspended account.

## Testing

```bash
npm test                                            # 87 unit tests
cd ../firestore-tests && npm run test:flare         # 63 Firestore rules assertions
cd ../firestore-tests && npm run test:flare-storage # 21 Storage rules assertions
```

The rules suite runs against the real Firestore emulator (needs a JDK), so
what it checks is what Firebase enforces. It was verified to go red, not just
green — see `../firestore-tests/README.md`.

## Auth flow

This follows the standard Firebase + Next.js App Router pattern, since
Firebase Admin cannot verify anything inside a Server Component or the Edge
runtime without a cookie to read:

1. The browser signs in with the Firebase client SDK
   (`signInWithEmailAndPassword`, or any provider added later) and gets back
   a short-lived Firebase ID token.
2. The browser POSTs that ID token to `/api/auth/session`, which verifies it
   with `firebase-admin` and mints a longer-lived **session cookie**, set
   `httpOnly` + `secure` (in production) so client-side JavaScript can never
   read it.
3. `middleware.ts` runs on the Edge runtime and can only check whether the
   session cookie is *present*, because `firebase-admin` needs Node.js APIs
   the Edge runtime doesn't have — so it's a fast redirect for the common
   case, not the security boundary.
4. Every protected Server Component or Route Handler calls
   `getCurrentUser()` from `src/lib/auth/session.ts`, which runs on Node.js
   and does the real cryptographic verification (and revocation check)
   against Firebase. Nothing should treat middleware's cookie-presence check
   as sufficient on its own.

## Getting started

```bash
cp .env.example .env.local   # fill in your Firebase project's values
npm install
npm run dev
```

You'll need a Firebase project with **Authentication** (Email/Password
provider enabled) and **Cloud Firestore** turned on. See `.env.example` for
exactly which console pages each value comes from.

To deploy the Firestore rules themselves (separately from the Next.js app):

```bash
firebase deploy --only firestore:rules --project <your-project-id>
```

## Next steps

1. Get the Figma file shared with a viewable account, then implement the
   real screens with `get_design_context`.
2. Answer the ten open questions in `docs/DATA-MODEL.md`. Three block work:
   the language list (i18n is expensive to retrofit), the registration
   mechanism, and whether assessments are single- or multi-answer.
3. Build the assessment grading path — it depends on question 1 above.
4. Finish the admin surface. Accounts, announcements, the audit log, lesson
   authoring and file/video uploads are built. Still missing: assessment question authoring
   (blocked on single- vs multi-answer and the passing score), file and video
   uploads (needs Firebase Storage and the hosting decision), and certificates
   and compliance reports (blocked on the template and signatory).
5. Render the stored Markdown on the learner side. It is intentionally not
   previewed in the authoring UI yet: a preview built on a different renderer
   than production is a preview that lies, so both should use one renderer,
   written when the learner screen is.
