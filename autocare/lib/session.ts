import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from './prisma';
import type { AppRole } from './rbac';

/**
 * Server-side session guards.
 *
 * THIS is the security boundary — not the middleware. Every server action,
 * route handler and page calls one of these before it touches data, because a
 * request can be aimed straight at an endpoint without ever rendering a page.
 *
 * Each call re-reads the User row rather than trusting the JWT alone. That
 * costs one indexed primary-key lookup per request and buys three things the
 * token cannot give us:
 *
 *   1. Turning an account off logs it out NOW. Previously a disabled user kept
 *      working until their 30-minute token expired.
 *   2. Resetting a password kills that user's other sessions, via tokenVersion.
 *   3. Role changes take effect on the next request, not the next login.
 *
 * The middleware still reads the token only — it runs on the Edge with no
 * database — which is exactly why it is a convenience layer and this is not.
 */

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  locale: string;
  policyAccepted: boolean;
  mustChangePassword: boolean;
}

/**
 * Decide whether a set of token claims still corresponds to a usable account.
 *
 * Split out from `getSessionUser` so the revocation rules can be exercised
 * directly against a database in tests/access-control.test.ts, with no
 * Next.js request context in play. This is the part that matters, so it is the
 * part that is tested.
 */
export async function resolveSessionUser(
  id: string | undefined,
  tokenVersion: number | undefined,
  sid?: string,
): Promise<SessionUser | null> {
  if (!id) return null;

  // This sign-in was logged out. Checked alongside the account itself.
  const [revoked, user] = await Promise.all([
    sid ? prisma.revokedSession.findUnique({ where: { sid }, select: { sid: true } }) : null,
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        locale: true,
        isActive: true,
        tokenVersion: true,
        policyAcceptedAt: true,
        mustChangePassword: true,
        lockedUntil: true,
      },
    }),
  ]);
  if (revoked) return null;

  // Deleted, disabled, or locked out since the token was minted.
  if (!user || !user.isActive) return null;
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;

  // Password reset or forced sign-out since the token was minted.
  if ((tokenVersion ?? 0) !== user.tokenVersion) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    locale: user.locale,
    policyAccepted: Boolean(user.policyAcceptedAt),
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * The signed-in user, or null. Never throws.
 *
 * Returns null — i.e. signed out — when the account has been disabled or its
 * tokenVersion has moved on, even if the cookie is still cryptographically
 * valid.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return resolveSessionUser(session?.user?.id, session?.user?.tokenVersion, session?.user?.sid);
}

/** How long a logged-out sign-in is remembered. Far longer than any session lives. */
const REVOKED_KEEP_DAYS = 30;

/**
 * Record this sign-in as logged out, so its cookie is refused from now on —
 * even a copy that a request still in flight sets again after logout.
 * Also clears out entries old enough that their cookies are long dead.
 */
export async function revokeSession(sid: string | undefined, userId: string): Promise<void> {
  if (!sid) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.revokedSession.upsert({
      where: { sid },
      create: {
        sid,
        userId,
        expiresAt: new Date(now.getTime() + REVOKED_KEEP_DAYS * 24 * 60 * 60 * 1000),
      },
      update: {},
    }),
    prisma.revokedSession.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
}

/**
 * Where a page sends a cookie that is no longer any good (logged out, account
 * turned off, password reset). It clears the cookie, then shows the login
 * page. Sending it straight to /login instead looped forever: the middleware
 * saw a well-formed cookie and sent it back to the page.
 */
export const END_SESSION_PATH = '/api/session/end';

/** Thrown by the `require*` helpers used inside server actions. */
export class AuthorizationError extends Error {
  constructor(
    public readonly kind: 'unauthenticated' | 'forbidden',
    message = kind,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * For PAGES: redirect somewhere friendly rather than showing an error.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(END_SESSION_PATH);
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== 'ADMIN') redirect('/dashboard?denied=1');
  return user;
}

/**
 * For SERVER ACTIONS and ROUTE HANDLERS: throw, so the caller can turn it into
 * a plain-language message instead of a redirect mid-mutation.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError('unauthenticated');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new AuthorizationError('forbidden');
  return user;
}

/** Require a specific capability from lib/rbac's `can` map. */
export async function requireCapability(
  check: (role: AppRole | undefined) => boolean,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!check(user.role)) throw new AuthorizationError('forbidden');
  return user;
}

/** The shape every server action returns, so forms can handle results uniformly. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; messageKey?: string }
  | { ok: false; messageKey: string; fieldErrors?: Record<string, string> };

/**
 * Wrap a server action body so an authorization failure or an unexpected crash
 * becomes a friendly message key instead of a stack trace on the user's screen.
 */
export async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, messageKey: 'errors.forbidden' };
    }
    // Next.js signals redirect/notFound by throwing — let those through.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
        (error as { digest: string }).digest === 'NEXT_NOT_FOUND')
    ) {
      throw error;
    }
    console.error('[action] unhandled error', error);
    return { ok: false, messageKey: 'common.unknownError' };
  }
}
