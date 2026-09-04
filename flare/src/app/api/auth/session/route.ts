import { NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Exchanges a Firebase ID token (minted client-side by firebase/auth) for a
// server-verified, httpOnly session cookie. This is the standard Firebase +
// Next.js pattern: the client SDK handles the sign-in UI and providers, the
// server never sees a password, and the resulting cookie is what protects
// Server Components / Route Handlers / middleware from here on.
export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let sessionCookie: string;
  try {
    sessionCookie = await createSessionCookie(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired ID token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 5,
  });
  return response;
}

// Signs the caller out by clearing the session cookie. This only ends the
// current browser session; it does not revoke the Firebase refresh token, so
// it is not sufficient on its own for a "sign out of all devices" feature.
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
