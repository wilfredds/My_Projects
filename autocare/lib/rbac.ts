import type { Role } from '@prisma/client';

/**
 * Role-based access control, defined once and consulted from three places:
 *   1. middleware.ts    — blocks the request before the page renders
 *   2. lib/session.ts   — re-checks inside every server action / route handler
 *   3. the navigation   — hides links the user cannot use
 *
 * The middleware check is a convenience for the user. The server-side re-check
 * is the real control: never trust that a request came through the middleware.
 */

export type AppRole = Role;

/** Route prefixes only an ADMIN may open. */
export const ADMIN_ONLY_PREFIXES = [
  '/reports',
  '/users',
  '/settings',
  '/audit',
  '/trash',
] as const;

/** Route prefixes any signed-in user may open. */
export const AUTHENTICATED_PREFIXES = [
  '/dashboard',
  '/jobs',
  '/customers',
  '/vehicles',
  '/services',
  '/account',
] as const;

/** Pages that never require a session. */
/**
 * Reachable without signing in. /setup is the first-run page of a fresh
 * install; it 404s as soon as any account exists (see lib/setup.ts).
 */
export const PUBLIC_PATHS = ['/login', '/policy', '/setup'] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function canAccessPath(role: AppRole | undefined, pathname: string): boolean {
  if (isPublicPath(pathname)) return true;
  if (!role) return false;
  if (isAdminOnlyPath(pathname)) return role === 'ADMIN';
  return true;
}

/** Capabilities, so components ask "may I?" instead of comparing role strings. */
export const can = {
  viewReports: (role?: AppRole) => role === 'ADMIN',
  manageUsers: (role?: AppRole) => role === 'ADMIN',
  editSettings: (role?: AppRole) => role === 'ADMIN',
  viewAuditLog: (role?: AppRole) => role === 'ADMIN',
  exportData: (role?: AppRole) => role === 'ADMIN',
  /** STAFF may look at the service catalog but only an ADMIN may change it. */
  manageServices: (role?: AppRole) => role === 'ADMIN',
  viewServices: (role?: AppRole) => role === 'ADMIN' || role === 'STAFF',
  manageJobs: (role?: AppRole) => role === 'ADMIN' || role === 'STAFF',
  /**
   * Deleting is ADMIN-only. The role table grants STAFF "create/view/edit
   * jobs" and stops there — a job is the shop's financial record, so removing
   * one is an owner decision. Deletes are soft anyway (see the Trash page), so
   * an owner can undo a mistake.
   */
  deleteJobs: (role?: AppRole) => role === 'ADMIN',
  restoreJobs: (role?: AppRole) => role === 'ADMIN',
  purgeJobs: (role?: AppRole) => role === 'ADMIN',
  manageCustomers: (role?: AppRole) => role === 'ADMIN' || role === 'STAFF',
  /** Removing a customer or vehicle outright is an owner-level decision. */
  deleteCustomers: (role?: AppRole) => role === 'ADMIN',
} as const;

/** Navigation entries, filtered by what the role may actually reach. */
export interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: 'home' },
  { href: '/jobs', labelKey: 'jobs', icon: 'clipboard' },
  { href: '/customers', labelKey: 'customers', icon: 'users' },
  { href: '/vehicles', labelKey: 'vehicles', icon: 'car' },
  { href: '/services', labelKey: 'services', icon: 'wrench' },
  { href: '/reports', labelKey: 'reports', icon: 'chart', adminOnly: true },
  { href: '/trash', labelKey: 'trash', icon: 'trash', adminOnly: true },
  { href: '/users', labelKey: 'users', icon: 'shield', adminOnly: true },
  { href: '/settings', labelKey: 'settings', icon: 'settings', adminOnly: true },
  { href: '/audit', labelKey: 'audit', icon: 'history', adminOnly: true },
];

export function navItemsFor(role: AppRole | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === 'ADMIN');
}
