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
//
// Each variable is read by STATIC property access, and that is load-bearing.
// Next.js substitutes NEXT_PUBLIC_ values into the client bundle by finding
// `process.env.NEXT_PUBLIC_SOMETHING` in the source text. A dynamic lookup —
// `process.env[name]` — is invisible to that substitution, so it compiles
// fine, passes typecheck, and then reads undefined in every browser. Do not
// refactor this into a loop or a helper that takes the name as a string.
export function getFirebaseClientConfig() {
  return demandAll({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

/** Fails naming the env vars that are missing, and keeps the object's shape. */
function demandAll<T extends Record<string, string | undefined>>(
  config: T,
): { [K in keyof T]: string } {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${camelToScreaming(key)}`);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
  return config as { [K in keyof T]: string };
}

function camelToScreaming(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

// SERVER ONLY. FIREBASE_PRIVATE_KEY holds a service account private key —
// it must never reach a Client Component or a NEXT_PUBLIC_ variable.
/**
 * The Storage bucket the Admin SDK writes to.
 *
 * Falls back to the public value, which names the same bucket — the bucket id
 * is not a secret, and duplicating it as a server-only variable just creates
 * two places to get it wrong.
 */
export function getStorageBucket(): string {
  const bucket =
    process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      "Missing storage bucket: set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (or FIREBASE_STORAGE_BUCKET).",
    );
  }
  return bucket;
}

export function getFirebaseAdminConfig() {
  return {
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    // Env files can't hold literal newlines, so the key is stored with escaped
    // \n sequences and unescaped here before handing it to the Admin SDK.
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}
