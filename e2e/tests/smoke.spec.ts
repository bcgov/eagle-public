import { test, expect } from '@playwright/test';
import { ready, expectA11ySmoke } from '../support/helpers';

/**
 * Every top-level route: it loads, it reports analytics, and it holds the accessibility
 * basics. Route-specific content lives in the other specs.
 */
const ROUTES = [
  '/',
  '/contact',
  '/legislation',
  '/compliance-oversight',
  '/process',
  '/search-help',
  '/news',
  '/project-notifications',
  '/projects-list',
  '/projects',
  '/search',
  '/cac-unsubscribe',
];

for (const route of ROUTES) {
  test(`${route} loads, posts analytics and passes the a11y smoke`, async ({ page }, testInfo) => {
    const analytics = page.waitForRequest(
      r => new URL(r.url()).pathname === '/analytics' && r.method() === 'POST',
      { timeout: 60_000 },
    );

    await page.goto(route);
    await ready(page);

    expect(new URL(page.url()).pathname).toBe(route === '/' ? '/' : route);
    await analytics;

    const { skipLinks } = await expectA11ySmoke(page);
    // Recorded, not asserted: prod ships no skip link on any route.
    testInfo.annotations.push({ type: 'skip-link count', description: `${route} => ${skipLinks}` });
  });
}
