import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { headers } from 'next/headers';
import { authConfig } from './auth.config';
import { verifyCredentials } from './lib/auth-logic';
import { loginSchema } from './lib/validation';
import { prisma } from './lib/prisma';
import { hit, reset } from './lib/rate-limit';

/**
 * The Node-runtime Auth.js instance: `authConfig` plus the Credentials
 * provider.
 *
 * `authorize` is deliberately read-only with respect to the failure counters.
 * Counting failed attempts, locking the account and writing the audit rows all
 * happen in the login server action (app/(auth)/login/actions.ts) so that one
 * attempt is never counted twice.
 *
 * The checks here still stand on their own, so a request posted straight at
 * /api/auth/callback/credentials cannot bypass the lockout, sign in to a
 * disabled account, or be used to brute-force without tripping the IP limit.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        // The login server action rate-limits by IP too, but this endpoint is
        // reachable directly, so it needs its own limit rather than relying on
        // the caller having come through the form.
        let ip: string | null = null;
        try {
          const h = await headers();
          ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
        } catch {
          ip = null;
        }
        const limitKey = `authorize:${ip ?? 'unknown'}`;
        if (!hit(limitKey).allowed) return null;

        const result = await verifyCredentials(parsed.data.username, parsed.data.password);
        if (!result.ok) return null;

        // Only failures should count toward the limit. Without this, every
        // successful sign-in also counted, and a shop whose staff share one
        // internet connection was locked out after ten logins in five minutes
        // — right password or not. The form's own limit already works this way.
        reset(limitKey);

        const account = await prisma.user.findUnique({
          where: { id: result.user.id },
          select: {
            policyAcceptedAt: true,
            tokenVersion: true,
            mustChangePassword: true,
          },
        });

        return {
          id: result.user.id,
          name: result.user.name,
          username: result.user.username,
          role: result.user.role,
          locale: result.user.locale,
          policyAccepted: Boolean(account?.policyAcceptedAt),
          tokenVersion: account?.tokenVersion ?? 0,
          mustChangePassword: Boolean(account?.mustChangePassword),
        };
      },
    }),
  ],
});
