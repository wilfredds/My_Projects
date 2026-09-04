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

What's real and permanent already: the Firebase project wiring, the
session-cookie auth flow, the Firestore security rules, and the project
structure. Rebuilding the UI once the design is accessible should not touch
any of that.

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
    api/auth/session/route.ts   # exchanges a Firebase ID token for a session cookie
    sign-in/page.tsx            # placeholder sign-in screen (real auth flow)
    dashboard/page.tsx          # placeholder protected page
  lib/
    firebase/
      env.ts       # validates and centralizes all Firebase env vars
      client.ts     # browser Firebase app (auth, firestore)
      admin.ts      # server Firebase app (firebase-admin)
    auth/
      session.ts    # creates/reads the httpOnly session cookie server-side
middleware.ts        # redirects signed-out visitors away from /dashboard
firestore.rules       # the actual access-control boundary for Firestore
firebase.json         # points the Firebase CLI at firestore.rules
```

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
   real screens with `get_design_context` against node `57:374`.
2. Design the actual Firestore schema once the client's content/data model
   is known — `firestore.rules` currently only covers a `users/{uid}`
   profile document as a starting example.
3. Decide on a sign-up flow (currently absent on purpose): user creation
   should likely go through a server-side path so the profile document can
   set fields the client shouldn't control directly, per the note in
   `firestore.rules`.
