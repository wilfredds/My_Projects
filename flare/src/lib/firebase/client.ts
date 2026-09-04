"use client";

import { getApps, initializeApp, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebaseClientConfig } from "./env";

// Next.js hot-reloads client modules in dev, which would otherwise call
// initializeApp() again and throw "app already exists" — reuse the existing
// instance when one is already registered.
const app = getApps().length ? getApp() : initializeApp(getFirebaseClientConfig());

export const auth = getAuth(app);
export const db = getFirestore(app);
