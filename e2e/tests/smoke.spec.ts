import { test, expect } from '../support/fixtures';
import { ready, expectA11ySmoke } from '../support/helpers';

/**
 * Every top-level route: it loads and it holds the accessibility basics. Route-specific content
 * lives in the other specs.
 *
 * Analytics is not asserted: penguin-analytics is retired, and the eagle-analytics client only
 * posts when EAGLE_ANALYTICS_URL is set, which no local or preview run sets.
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
  '/projects',
  '/search',
  '/search?record=projects',
];

for (const route of ROUTES) {
  test(`${route} loads and passes the a11y smoke`, async ({ page }, testInfo) => {
    await page.goto(route);
    await ready(page);

    expect(new URL(page.url()).pathname).toBe(new URL(route, page.url()).pathname);

    const { skipLinks } = await expectA11ySmoke(page);
    // Recorded, not asserted: prod ships no skip link on any route.
    testInfo.annotations.push({ type: 'skip-link count', description: `${route} => ${skipLinks}` });
  });
}
