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
  test('shows recent activity cards and the about section', async ({ page }) => {
    const calls = recordApiCalls(page);
    await page.goto('/');
    await ready(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Recent Activities & Updates' }),
    ).toBeVisible();
    await expect(page.locator('#tableTop tbody tr')).not.toHaveCount(0);
    await expect(page.getByRole('link', { name: /View All Activities & Updates/ })).toBeVisible();

    for (const card of ['Legislation', 'Process & Procedures', 'Compliance Oversight']) {
      await expect(page.getByRole('heading', { level: 3, name: card })).toBeVisible();
    }

    checkBaseline('home', calls);
  });

  // Either backend can serve the strip: eagle-api from its bespoke route, demi-search from
  // `/search?dataset=RecentActivity&top=true`. Both answer the same four curated items.
  test('@data recent activity cards come from the top-news read', async ({ page }) => {
    const res = page.waitForResponse((r) => isTopNewsUrl(r.url()) && r.status() === 200);
    await page.goto('/');
    const active = topNewsRows(await (await res).json()).filter((a: any) => a.active);
    await ready(page);
    await expect(page.locator('#tableTop tbody tr')).toHaveCount(active.length);
    await expect(page.locator('#tableTop tbody tr').first()).toContainText(active[0].headline);
  });
});
