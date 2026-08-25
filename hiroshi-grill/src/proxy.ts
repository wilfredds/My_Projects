import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "./lib/csp";
import { hardenedCookieOptions } from "./lib/supabase/cookie-options";

/** Paths that require a signed-in staff member. */
function isProtected(pathname: string): boolean {
  return pathname === "/portal/dashboard" || pathname.startsWith("/portal/dashboard/");
}

export async function proxy(request: NextRequest) {
  /* crypto.randomUUID() is available in the Edge runtime and is
     cryptographically random — Math.random() would be guessable and therefore
     worthless as a nonce. */
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, {
    turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    /* `=== "development"` and not `!== "production"` — if NODE_ENV is ever
       unset or misspelt we want the strict policy, not the loose one. A
       security control should fail closed. */
    dev: process.env.NODE_ENV === "development",
  });

  /* Pass the policy inward on the request so Next can read the nonce and stamp
     it onto the script tags it renders, plus the bare nonce on `x-nonce` for
     the root layout to put on our own inline JSON-LD tag. */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  /**
   * Keep the Supabase session alive.
   *
   * Access tokens are short-lived and have to be exchanged for fresh ones,
   * which means writing new cookies. Server components are not allowed to set
   * cookies — so if this did not happen here, staff sessions would expire
   * mid-shift and the portal would start bouncing people to the login page for
   * no visible reason. Middleware is the one place in the App Router that can
   * both read the request and set cookies on the way back.
   *
   * `getUser()`, not `getSession()`: this call is what revalidates the token
   * with the Auth server. `getSession()` would hand back whatever the cookie
   * claims, unverified, which is worthless as a basis for the redirect below.
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /* Guarded, because the public site must keep working before Supabase is
     configured. Without this check the whole restaurant — menu, hours, the
     reservation form — would 500 on a missing environment variable. The portal
     is the only part that actually needs auth. */
  if (url && anonKey) {
    try {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            /* Refreshed cookies go onto the REQUEST as well as the response, so
               the server components rendering further down this same pass see
               the new session rather than the stale one. */
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({ request: { headers: requestHeaders } });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, hardenedCookieOptions(options));
            }
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user && isProtected(request.nextUrl.pathname)) {
        const signIn = new URL("/portal", request.url);
        signIn.searchParams.set("next", request.nextUrl.pathname);

        /* The redirect gets its own response object, so any cookies the refresh
           just set have to be copied across or the browser loses them and the
           next request starts from an even staler session. */
        const redirect = NextResponse.redirect(signIn);
        for (const cookie of response.cookies.getAll()) {
          redirect.cookies.set(cookie);
        }
        redirect.headers.set("content-security-policy", csp);
        return redirect;
      }
    } catch (error) {
      /* A failure here must not take the site down. The page itself calls
         requireStaff(), which fails closed on its own — so the worst case is
         that someone reaches the dashboard route and is bounced one step later
         instead of one step earlier. */
      console.error("[proxy] session refresh failed:", error);
    }
  }

  /* And outward on the response so the browser actually enforces it. */
  response.headers.set("content-security-policy", csp);

  return response;
}

export const config = {
  /*
   * Skip the static asset paths. They are plain files with no scripts to
   * protect, and running this on every image would be pure overhead. The
   * negative lookahead is the pattern Next documents for exactly this.
   */
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
