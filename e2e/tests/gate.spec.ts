import { test, expect } from '@playwright/test';

/**
 * The password curtain. Uses the un-seeded `test` from Playwright, not `support/fixtures`, so
 * the curtain is actually rendered. Needs GATE_PASSWORD; skipped when the environment under test
 * has ACCESS_GATE off.
 */
const PASSWORD = process.env.GATE_PASSWORD;

async function gateIsOn(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
  const r = await request.get('/api/config');
  return r.ok() && (await r.json()).ACCESS_GATE === true;
}

/**
 * The curtain is decided by `/api/config`, fetched once at boot. When that request fails the app
 * falls back to `env.js`, where ACCESS_GATE is off - so a missing curtain can mean a dropped
 * request rather than a defect. Reload before believing it.
 */
async function openCurtain(page: import('@playwright/test').Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/');
    try {
      await page.locator('#gate-password').waitFor({ state: 'visible', timeout: 15_000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error('the access gate never rendered');
}

test.describe('access gate', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await gateIsOn(request)), 'ACCESS_GATE is not on for this environment');
  });

  test('the curtain hides the app and the right password opens it', async ({ page }) => {
    test.skip(!PASSWORD, 'set GATE_PASSWORD to exercise the unlock');
    await openCurtain(page);
    const field = page.locator('#gate-password');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'EPIC is not open to the public yet',
    );
    // The app itself is not rendered behind the curtain.
    await expect(page.locator('header .navbar, nav.navbar')).toHaveCount(0);

    await field.fill(PASSWORD!);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.locator('#gate-password')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(
      'EPIC is not open to the public yet',
    );
    // The flag is remembered in localStorage, so a reload does not re-ask.
    expect(await page.evaluate(() => localStorage.getItem('eagle-gate'))).toBe('1');
    await page.reload();
    await expect(page.locator('#gate-password')).toHaveCount(0);
  });

  test('a wrong password is rejected in place', async ({ page }) => {
    await openCurtain(page);
    await page.locator('#gate-password').fill('not-the-password');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#gate-error')).toHaveText('Incorrect password');
    await expect(page.locator('#gate-password')).toBeVisible();
  });

  test('the password field is focused and labelled', async ({ page }) => {
    await openCurtain(page);
    const field = page.locator('#gate-password');
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('type', 'password');
    await expect(page.locator('label[for="gate-password"]')).toHaveText('Password');
  });
});
