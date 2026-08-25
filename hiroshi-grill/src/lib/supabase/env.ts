/**
 * Reads and checks the Supabase environment variables.
 *
 * The point of putting this in one place is the split down the middle: two
 * values are safe to publish, one would hand over the whole database. Keeping
 * them in separate functions — where the dangerous one throws if anything but
 * server code calls it — makes that boundary something the code enforces
 * rather than something you have to remember.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/**
 * Safe in the browser. The anon key is not a password and grants no privileges
 * of its own — every request made with it is still judged by Row Level
 * Security. Publishing it is the intended design, not a leak.
 */
export function publicSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

/**
 * SERVER ONLY. The service-role key bypasses Row Level Security completely —
 * it can read every guest's phone number and delete every booking. It is the
 * one credential in this project that is genuinely catastrophic to leak.
 *
 * The guard below is cheap insurance against the classic accident: importing a
 * server helper into a component that later gains `"use client"`, and shipping
 * the key to every visitor in the JavaScript bundle. If that ever happens, this
 * throws at build time instead of leaking silently.
 */
export function serviceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must never be read in the browser.");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
