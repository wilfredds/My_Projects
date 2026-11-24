'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { requireAdmin, requireUser, guarded, type ActionResult } from '@/lib/session';
import { shopSettingsSchema, localeSchema, fieldErrors } from '@/lib/validation';
import { SHOP_SETTINGS_ID, getShopInfo } from '@/lib/settings';
import { checkLogoDataUrl } from '@/lib/logo';
import { isAccent } from '@/lib/branding';
import { LOCALE_COOKIE } from '@/i18n/locales';

/** Shop details printed on every receipt. ADMIN only. */
export async function saveShopSettingsAction(input: {
  name: string;
  address: string;
  phone: string;
  email?: string;
  footer?: string;
  tin?: string;
}): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();

    const parsed = shopSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        messageKey: 'errors.requiredField',
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    await prisma.shopSetting.upsert({
      where: { id: SHOP_SETTINGS_ID },
      create: { id: SHOP_SETTINGS_ID, ...parsed.data },
      update: parsed.data,
    });

    await audit({
      userId: admin.id,
      action: 'UPDATE_SETTINGS',
      entity: 'ShopSetting',
      entityId: SHOP_SETTINGS_ID,
      metadata: { name: parsed.data.name },
    });

    // The accent and name show on every page, so refresh them all.
    revalidatePath('/', 'layout');
    return { ok: true, messageKey: 'settings.saved' };
  });
}

/**
 * The shop's accent colour, saved the moment it is tapped so the owner sees
 * the whole app change straight away. Only the curated accents are accepted.
 */
export async function saveAccentAction(accent: string): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();
    if (!isAccent(accent)) return { ok: false, messageKey: 'common.unknownError' };

    const current = await getShopInfo();
    await prisma.shopSetting.upsert({
      where: { id: SHOP_SETTINGS_ID },
      create: {
        id: SHOP_SETTINGS_ID,
        name: current.name,
        address: current.address,
        phone: current.phone,
        accent,
      },
      update: { accent },
    });

    await audit({
      userId: admin.id,
      action: 'UPDATE_SETTINGS',
      entity: 'ShopSetting',
      entityId: SHOP_SETTINGS_ID,
      metadata: { accent },
    });

    revalidatePath('/', 'layout');
    return { ok: true, messageKey: 'settings.accentSaved' };
  });
}

/**
 * The shop's logo, or null to remove it. The browser has already resized it
 * to a PNG; `checkLogoDataUrl` re-verifies that here before anything is saved.
 */
export async function saveShopLogoAction(dataUrl: string | null): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireAdmin();

    if (dataUrl !== null) {
      const check = checkLogoDataUrl(dataUrl);
      if (!check.ok) return { ok: false, messageKey: `settings.logoError_${check.reason}` };
    }

    const current = await getShopInfo();
    await prisma.shopSetting.upsert({
      where: { id: SHOP_SETTINGS_ID },
      create: {
        id: SHOP_SETTINGS_ID,
        name: current.name,
        address: current.address,
        phone: current.phone,
        logo: dataUrl,
      },
      update: { logo: dataUrl },
    });

    await audit({
      userId: admin.id,
      action: 'UPDATE_SETTINGS',
      entity: 'ShopSetting',
      entityId: SHOP_SETTINGS_ID,
      metadata: { logo: dataUrl ? 'updated' : 'removed' },
    });

    revalidatePath('/', 'layout');
    return { ok: true, messageKey: dataUrl ? 'settings.logoSaved' : 'settings.logoRemoved' };
  });
}

/**
 * A user's own language. Any signed-in user may change their own — this is not
 * an admin action, it just also lives on the Settings page.
 */
export async function saveMyLocaleAction(locale: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireUser();

    const parsed = localeSchema.safeParse({ locale });
    if (!parsed.success) return { ok: false, messageKey: 'common.unknownError' };

    await prisma.user.update({
      where: { id: user.id },
      data: { locale: parsed.data.locale },
    });

    const store = await cookies();
    store.set(LOCALE_COOKIE, parsed.data.locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    revalidatePath('/', 'layout');
    return { ok: true, messageKey: 'settings.saved' };
  });
}
