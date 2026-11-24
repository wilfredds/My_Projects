import type { NextAuthConfig } from 'next-auth';

/**
 * The half of the Auth.js configuration that is safe to run on the Edge
 * runtime, i.e. everything except the Credentials provider (which needs Prisma
 * and bcrypt, neither of which runs on Edge).
 *
 * `middleware.ts` builds a NextAuth instance from THIS file only; `auth.ts`
 * spreads it and adds the provider for the Node runtime.
 */

/** Idle timeout: the session dies after 30 minutes without activity. */
export const SESSION_MAX_AGE_SECONDS = 30 * 60;

export const authConfig = {
  // Trust the deployment's host header (Vercel sets it correctly).
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Re-issue the cookie at most every 5 minutes of activity, which is what
    // turns maxAge into a sliding *idle* timeout rather than an absolute one.
    updateAge: 5 * 60,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [], // filled in by auth.ts — must stay empty for the Edge build
  callbacks: {
    /**
     * Copy the fields we need for RBAC onto the token so that middleware can
     * make its decision without touching the database.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: 'ADMIN' | 'STAFF' }).role ?? 'STAFF';
        token.username = (user as { username?: string }).username;
        token.locale = (user as { locale?: string }).locale ?? 'fil';
        token.policyAccepted = (user as { policyAccepted?: boolean }).policyAccepted ?? false;
        // Pins the session to a generation of the account. lib/session.ts
        // rejects the request if the User row has moved on (password reset,
        // account disabled), which is what makes revocation immediate.
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        // A fresh id for this one sign-in. Logging out records it as revoked
        // (lib/session.ts), so a cookie that a request still in flight puts
        // back a moment after logout is refused, without signing the same
        // person out on their other devices.
        token.sid = crypto.randomUUID();
      }
      // `update()` from the client (language switch, policy acknowledgement).
      if (trigger === 'update' && session) {
        if (typeof session.locale === 'string') token.locale = session.locale;
        if (session.policyAccepted === true) token.policyAccepted = true;
        if (session.mustChangePassword === false) token.mustChangePassword = false;
        if (typeof session.tokenVersion === 'number') token.tokenVersion = session.tokenVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'STAFF';
        session.user.username = token.username as string;
        session.user.locale = token.locale as string;
        session.user.policyAccepted = Boolean(token.policyAccepted);
        session.user.tokenVersion = (token.tokenVersion as number) ?? 0;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.sid = token.sid as string | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
