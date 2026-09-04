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

## Testing

```bash
npm test                              # rollup, request validation, theme
cd ../firestore-tests && npm run test:flare   # 63 rules assertions
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
4. Design and price the admin surface. It is confirmed as needed and no
   frames exist for it; see `docs/DATA-MODEL.md`.
