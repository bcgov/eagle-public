import { test, expect } from '../support/fixtures';
import {
  ready,
  recordApiCalls,
  checkBaseline,
  isTopNewsUrl,
  topNewsRows,
} from '../support/helpers';

/**
 * The static content pages and the home page. The activities and project-notification lists used
 * to live here too; they are record types on /search now, covered by `search.spec.ts`, and their
 * old addresses by `routing.spec.ts`.
 */

test.describe('content pages', () => {
  const HEADINGS: [string, string][] = [
    ['/contact', 'Connect With Us'],
    ['/legislation', 'Legislation'],
    ['/compliance-oversight', 'Compliance Oversight'],
    ['/process', 'Process & Procedures'],
    ['/search-help', 'Advanced Search Help'],
  ];

  for (const [route, heading] of HEADINGS) {
    test(`${route} renders "${heading}"`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    });
  }

  test('/contact links the EAO and compliance mailboxes', async ({ page }) => {
    await page.goto('/contact');
    await ready(page, 500);
    await expect(
      page.getByRole('heading', { level: 3, name: 'B.C. Environmental Assessment Office' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Report Natural Resource Violations' }),
    ).toBeVisible();
  });

  test('/search-help explains quotes and hyphens', async ({ page }) => {
    await page.goto('/search-help');
    await ready(page, 500);
    await expect(page.getByRole('heading', { level: 3, name: 'Quotes' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Hyphens' })).toBeVisible();
  });
});

test.describe('home', () => {
  test('shows the updates feed and the rail', async ({ page }) => {
    const calls = recordApiCalls(page);
    await page.goto('/');
    await ready(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Updates' })).toBeVisible();
    await expect(page.locator('.home-update[href]')).not.toHaveCount(0);
    await expect(page.getByRole('link', { name: /View all Activities & Updates/ })).toBeVisible();
    for (const heading of ['Open for comment', 'Recent Uploads']) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    }

    checkBaseline('home', calls);
  });

  // Either backend can serve the strip: eagle-api from its bespoke route, demi-search from
  // `/search?dataset=RecentActivity&top=true`. Both answer the same four curated items.
  test('@data update cards come from the top-news read', async ({ page }) => {
    const res = page.waitForResponse((r) => isTopNewsUrl(r.url()) && r.status() === 200);
    await page.goto('/');
    // The feed shows updates only; comment-period activity belongs to the rail.
    const shown = topNewsRows(await (await res).json()).filter(
      (a: any) => a.active && ['News', 'Project Notification News'].includes(a.type),
    );
    await ready(page);
    await expect(page.locator('.home-update[href]')).toHaveCount(shown.length);
    await expect(page.locator('.home-update[href]').first()).toContainText(shown[0].headline);
  });
});
