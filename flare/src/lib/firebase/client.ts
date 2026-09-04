"use client";

import { getApps, initializeApp, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { getFirebaseClientConfig } from "./env";

// Next.js hot-reloads client modules in dev, which would otherwise call
// initializeApp() again and throw "app already exists" — reuse the existing
// instance when one is already registered.
const firstRun = getApps().length === 0;
const app = firstRun ? initializeApp(getFirebaseClientConfig()) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// Training files upload straight from the browser to Storage rather than
// through the server: a 500 MB video cannot pass through a serverless
// function. storage.rules is what authorizes those writes.
export const storage = getStorage(app);

// Point the browser SDK at the local emulators when asked. The server side
// switches on FIRESTORE_EMULATOR_HOST, which the browser cannot see, so this
// needs its own NEXT_PUBLIC_ flag — set it in .env.local alongside the
// emulator host variables, never in a deployed environment.
//
// Guarded on firstRun because connecting twice throws after a hot reload.
if (firstRun && process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
