import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Route prefixes that require a signed-in visitor.
const PROTECTED_PATHS = ["/dashboard"];

// Middleware runs on the Edge runtime, which cannot load firebase-admin (it
// needs Node.js APIs) — so this only checks that a session cookie is
// present, as a fast redirect for the common case. It is NOT the security
// boundary: getCurrentUser() in src/lib/auth/session.ts does the real
// cryptographic verification inside Server Components and Route Handlers,
// which do run on Node.js. Never trust this check alone to gate data access.
export function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
