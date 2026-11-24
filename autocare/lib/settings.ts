import { cache } from 'react';
import { prisma } from './prisma';
import { toAccent, type Accent } from './branding';

/**
 * Shop details printed on every receipt, and the shop's branding. Stored in a
 * single row so the owner can change them from the Settings page without a
 * redeploy. Every shop that installs AutoCare has its own row.
 */

export interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  email: string | null;
  footer: string | null;
  tin: string | null;
  accent: Accent;
  /** PNG data URL, or null to show the monogram instead. */
  logo: string | null;
}

/**
 * Shown only before a shop has been set up (see /setup), or if the settings
 * row cannot be read. A fresh install is never branded as another shop.
 */
export const DEFAULT_SHOP: ShopInfo = {
  name: 'AutoCare',
  address: '',
  phone: '',
  email: null,
  footer: null,
  tin: null,
  accent: 'kahel',
  logo: null,
};

export const SHOP_SETTINGS_ID = 'shop';

/**
 * Read once per request: the root layout (for the accent colour), the app
 * shell and the page itself all ask for it, and `cache` makes that one query.
 */
export const getShopInfo = cache(async (): Promise<ShopInfo> => {
  try {
    const row = await prisma.shopSetting.findUnique({ where: { id: SHOP_SETTINGS_ID } });
    if (!row) return DEFAULT_SHOP;
    return {
      name: row.name,
      address: row.address,
      phone: row.phone,
      email: row.email,
      footer: row.footer,
      tin: row.tin,
      accent: toAccent(row.accent),
      logo: row.logo,
    };
  } catch {
    // The Settings page must never take the whole app down if the row is missing.
    return DEFAULT_SHOP;
  }
});
