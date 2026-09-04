import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME = "flare_session";

// Firebase session cookies default to 2 weeks max; keep ours at 5 days so a
// stolen cookie has a shorter useful life, and refresh it on each sign-in.
const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000;

export async function createSessionCookie(idToken: string): Promise<string> {
  const adminAuth = getAdminAuth();
  // Throws if idToken is invalid/expired — callers must catch this and
  // respond 401 rather than setting a cookie for a token that didn't verify.
  await adminAuth.verifyIdToken(idToken);
  return adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS });
}

// Reads the session cookie already set on the request. Returns null instead
// of throwing when signed out or the cookie is invalid/expired/revoked, so
// callers can treat "no session" as a normal case, not an error path.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    // checkRevoked catches a session whose cookie survived a password
    // change or an explicit "sign out everywhere".
    return await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
