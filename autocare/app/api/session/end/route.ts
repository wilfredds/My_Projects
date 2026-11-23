import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/session/end — clear a session cookie that is no longer any good,
 * then go to the login page.
 *
 * Pages send a request here (lib/session.ts `END_SESSION_PATH`) when the
 * cookie is well-formed but the account behind it says no: logged out, turned
 * off, locked, or its password reset. Redirecting straight to /login looped
 * forever, because the middleware only sees that a cookie exists and sends a
 * signed-in visitor away from /login. This is a public path, so the
 * middleware lets it through without that check.
 */
export function GET() {
  // A relative Location, so the browser stays on whatever address it used
  // (request.url can name the server's own host, not the shop's domain).
  const response = new NextResponse(null, { status: 303, headers: { Location: '/login' } });
  const name = authConfig.cookies.sessionToken.name;
  response.cookies.set(name, '', { ...authConfig.cookies.sessionToken.options, maxAge: 0 });
  // Auth.js splits a large token across numbered cookies; clear those too.
  for (let i = 0; i < 4; i++) {
    response.cookies.set(`${name}.${i}`, '', { ...authConfig.cookies.sessionToken.options, maxAge: 0 });
  }
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
