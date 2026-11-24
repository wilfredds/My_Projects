'use server';

import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/audit';
import { hit } from '@/lib/rate-limit';
import { performSetup } from '@/lib/setup';
import { setupSchema, fieldErrors } from '@/lib/validation';

export interface SetupActionResult {
  ok: boolean;
  /** Message catalog key for the banner at the top of the form. */
  messageKey?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * First-run setup. Everything that matters is enforced in lib/setup.ts —
 * the code check, the "no accounts yet" check under a lock, and the
 * all-or-nothing transaction. This wrapper validates, rate-limits by IP so the
 * code cannot be guessed at speed, and maps the outcome to a message.
 */
export async function completeSetupAction(input: {
  code: string;
  shopName: string;
  address: string;
  phone: string;
  ownerName: string;
  username: string;
  password: string;
  starterServices: boolean;
}): Promise<SetupActionResult> {
  const ip = await getClientIp();
  if (!hit(`setup:${ip ?? 'unknown'}`).allowed) {
    return { ok: false, messageKey: 'setup.errorTooMany' };
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, messageKey: 'setup.errorCheckFields', fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    const result = await performSetup(prisma, parsed.data);
    if (result.ok) return { ok: true };
    const key =
      result.reason === 'bad-code'
        ? 'setup.errorCode'
        : result.reason === 'already-done'
          ? 'setup.errorDone'
          : 'setup.errorClosed';
    return { ok: false, messageKey: key };
  } catch (error) {
    // A username clash is impossible on an empty table; anything else is ours.
    console.error('[setup] failed', error instanceof Error ? error.message : error);
    return { ok: false, messageKey: 'common.unknownError' };
  }
}
