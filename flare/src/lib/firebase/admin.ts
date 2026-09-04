import "server-only";
import { getApps, initializeApp, cert, getApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminConfig, getStorageBucket } from "./env";

// Lazy on purpose: Next.js evaluates a route/page module's top-level code
// during `next build` (to collect page data), even for routes that render
// dynamically at request time. Eagerly calling cert() here would make every
// build fail without a real, PEM-parseable service account key — this way
// the build needs no Firebase secrets at all, and the credential is only
// read the first time a request actually needs it.
let app: App | undefined;

/**
 * True when the Firebase emulators are configured.
 *
 * The Admin SDK talks to them without authenticating, so local development
 * and the seed script need no service account key. A fake key is not a
 * substitute: cert() parses the PEM before it ever looks at the emulator.
 */
function usingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApp();
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? "flare-local";

  app = usingEmulators()
    ? initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` })
    : initializeApp({
        credential: cert(getFirebaseAdminConfig()),
        storageBucket: getStorageBucket(),
      });

  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
