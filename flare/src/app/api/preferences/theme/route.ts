import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { parseTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/lib/theme/theme";

/**
 * Persists the Dark Mode preference.
 *
 * Works signed out as well as signed in, which matters: the landing and
 * sign-in screens are themed too, and someone who prefers dark should not
 * have to authenticate before the app respects that.
 *
 *   - The cookie is what the server render reads, so it is always set.
 *   - Signed-in users also get it written to their profile, so the choice
 *     follows them to another device.
 *
 * The cookie is intentionally not httpOnly: the toggle sets it directly for
 * an instant response and posts here to catch up. It holds a display
 * preference, not a credential.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const theme = parseTheme((body as { theme?: unknown } | null)?.theme);
  if (!theme) {
    return NextResponse.json({ error: "invalid_theme" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, theme });
  response.cookies.set(THEME_COOKIE, theme, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
  });

  const session = await getCurrentUser();
  if (session) {
    try {
      await getAdminDb()
        .collection("users")
        .doc(session.uid)
        .set({ preferences: { theme } }, { merge: true });
    } catch (error) {
      // The cookie already carries the preference, so the user's choice took
      // effect. Losing the cross-device copy is not worth failing the request.
      console.error("[preferences] could not persist theme for", session.uid, error);
    }
  }

  return response;
}
