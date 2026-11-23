'use server';

import { auth, signOut } from '@/auth';
import { audit } from '@/lib/audit';
import { getSessionUser, revokeSession } from '@/lib/session';

export async function signOutAction(): Promise<void> {
  const session = await auth();
  const user = await getSessionUser();
  if (user) {
    // Revoke this sign-in on the server first. Clearing the cookie alone is
    // not enough: a request already in flight (a page prefetch) can set it
    // again a moment later, and the person would still be signed in.
    await revokeSession(session?.user?.sid, user.id);
    await audit({ userId: user.id, action: 'LOGOUT', entity: 'User', entityId: user.id });
  }
  await signOut({ redirectTo: '/login' });
}
