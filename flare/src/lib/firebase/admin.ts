import "server-only";
import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminConfig } from "./env";

// Lazy on purpose: Next.js evaluates a route/page module's top-level code
// during `next build` (to collect page data), even for routes that render
// dynamically at request time. Eagerly calling cert() here would make every
// build fail without a real, PEM-parseable service account key — this way
// the build needs no Firebase secrets at all, and the credential is only
// read the first time a request actually needs it.
let app: App | undefined;

function getAdminApp(): App {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp({ credential: cert(getFirebaseAdminConfig()) });
  }
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
