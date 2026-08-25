import type { CookieOptions } from "@supabase/ssr";

/**
 * Hardening applied to every Supabase auth cookie we write.
 *
 * ---------------------------------------------------------------------------
 * httpOnly — the one worth understanding
 * ---------------------------------------------------------------------------
 * By default `@supabase/ssr` writes the session cookie WITHOUT httpOnly,
 * because its browser client reads the session out of `document.cookie`. That
 * is a real trade-off, not an oversight: a session cookie readable by
 * JavaScript is a session cookie that any successful XSS can steal outright,
 * and a stolen session is worse than a stolen password because it skips the
 * login entirely.
 *
 * This project does not use the browser client. Sign-in is a server action and
 * the portal is server-rendered, so nothing in the browser ever needs to read
 * the session — the server reads it from the request headers, where httpOnly
 * makes no difference. So we take the hardening and give up a capability we
 * were not using.
 *
 * The consequence is worth writing down: **you cannot add `createBrowserClient`
 * back without turning this off.** If milestone 5 ever needs realtime updates
 * in the browser, do it through a server action or a route handler rather than
 * quietly deleting this line.
 *
 * ---------------------------------------------------------------------------
 * The rest
 * ---------------------------------------------------------------------------
 * sameSite: "lax" — the cookie is not sent on cross-site POSTs, which is most
 *   of CSRF handled before we write a single token. "lax" rather than "strict"
 *   so that following a link to the portal from elsewhere still arrives signed
 *   in.
 *
 * secure — HTTPS only, so the cookie never crosses a plain http connection.
 *   Off in development, because localhost has no certificate.
 *
 * path: "/" — the proxy runs site-wide and needs to refresh the session on any
 *   route, so the cookie has to be sent everywhere.
 */
export function hardenedCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: options.path ?? "/",
  };
}
