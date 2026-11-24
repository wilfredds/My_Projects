import { expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fil from '../messages/fil.json';
import { OWNER } from './env';

/** The Filipino UI text, so tests find buttons by what the owner reads. */
export const t = fil;

/** A short tag that makes this run's names unique (customers, plates…). */
export const RUN = Date.now().toString(36).slice(-6).toUpperCase();

/** Direct database access, for checking what a screen claims was saved. */
export const db = new PrismaClient();

/** Turn an ICU message into a regex that matches it with any value filled in. */
export function msg(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped.replace(/\\\{[^}]*\\\}/g, '.+'));
}

export async function login(page: Page, username = OWNER.username, password = OWNER.password) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.getByRole('button', { name: t.login.submit, exact: true }).click();
}

export async function loginAsOwner(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Wait for a success toast with this text. */
export async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible();
}

/** Peso as the app prints it in Filipino: ₱1,234.00 */
export function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The message box inside a form (not Next.js's hidden route announcer). */
export function formAlert(page: Page) {
  return page.locator('form [role="alert"]');
}
