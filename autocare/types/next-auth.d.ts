import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'STAFF';
      username: string;
      locale: string;
      policyAccepted: boolean;
      tokenVersion: number;
      mustChangePassword: boolean;
      /** This sign-in's own id, so logging out can revoke just this device. */
      sid?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'ADMIN' | 'STAFF';
    username?: string;
    locale?: string;
    policyAccepted?: boolean;
    tokenVersion?: number;
    mustChangePassword?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'ADMIN' | 'STAFF';
    username?: string;
    locale?: string;
    policyAccepted?: boolean;
    tokenVersion?: number;
    mustChangePassword?: boolean;
    sid?: string;
  }
}

export {};
