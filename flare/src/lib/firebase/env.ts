// Central place that reads and validates every Firebase-related env var.
// Import from here instead of touching process.env directly elsewhere, so a
// missing variable fails loudly at the one call site that needs it rather
// than silently producing `undefined` deep inside the SDK.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Safe to ship to the browser — these identify the Firebase project, they do
// not grant access to it. Firestore security rules are what actually gate
// access, not the secrecy of these values.
export function getFirebaseClientConfig() {
  return {
    apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: required("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: required("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: required("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}

// SERVER ONLY. FIREBASE_PRIVATE_KEY holds a service account private key —
// it must never reach a Client Component or a NEXT_PUBLIC_ variable.
export function getFirebaseAdminConfig() {
  return {
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    // Env files can't hold literal newlines, so the key is stored with escaped
    // \n sequences and unescaped here before handing it to the Admin SDK.
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}
