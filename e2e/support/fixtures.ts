import { test as base } from '@playwright/test';

/**
 * `ACCESS_GATE: true` in /api/config puts a shared-password curtain in front of the whole app.
 * The flag it remembers is a plain localStorage marker, so seeding it keeps every other spec
 * testing the app rather than the curtain. `gate.spec.ts` exercises the real password flow.
 */
export const GATE_KEY = 'eagle-gate';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((key) => {
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* private mode: the gate spec covers the password path */
      }
    }, GATE_KEY);
    await use(page);
  },
});

export { expect, type Page, type Locator } from '@playwright/test';
