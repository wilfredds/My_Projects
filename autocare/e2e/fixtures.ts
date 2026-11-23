import { test as base, expect } from '@playwright/test';

/**
 * Every test fails if the page throws, or if the browser blocks anything under
 * the Content-Security-Policy — so a broken script or a CSP regression can't
 * hide behind a screen that merely looks right.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(text)) {
        problems.push(`CSP: ${text}`);
      }
    });
    await use(page);
    expect(problems, problems.join('\n')).toEqual([]);
  },
});

export { expect };
