import { test, expect } from '../support/fixtures';
import {
  ready,
  recordApiCalls,
  checkBaseline,
  waitForSearch,
  total,
  pageCount,
} from '../support/helpers';

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

  test('@data recent activity cards come from /api/public/recentActivity', async ({ page }) => {
    const res = page.waitForResponse(
      (r) => r.url().includes('/api/public/recentActivity') && r.status() === 200,
    );
    await page.goto('/');
    const body = await (await res).json();
    const active = body.filter((a: any) => a.active);
    await ready(page);
    await expect(page.locator('#tableTop tbody tr')).toHaveCount(active.length);
    await expect(page.locator('#tableTop tbody tr').first()).toContainText(active[0].project.name);
  });
});

test.describe('news', () => {
  test('lists activities with a headline/date table', async ({ page }) => {
    const calls = recordApiCalls(page);
    const search = waitForSearch(page, 'RecentActivity');
    await page.goto('/news');
    const env = await search;
    await ready(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Activities & Updates' }),
    ).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Headline/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Date/ })).toBeVisible();

    const rows = page.locator('table[aria-label="table-template"] tbody tr');
    await expect(rows).toHaveCount(Math.min(10, total(env)));
    await expect(rows.first()).toContainText(env.searchResults[0].project.name);
    await expect(rows.first()).toContainText(env.searchResults[0].headline.trim());

    checkBaseline('news', calls);
  });
});

test.describe('project notifications', () => {
  test('lists notifications with per-row Details/Documents tabs', async ({ page }) => {
    const search = waitForSearch(page, 'ProjectNotification');
    await page.goto('/project-notifications');
    const env = await search;
    await ready(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Project Notifications in British Columbia' }),
    ).toBeVisible();

    const rows = page.locator('table[aria-label="table-template"] tbody tr');
    await expect(rows).toHaveCount(Math.min(10, total(env)));
    // The row title is upper-cased by CSS, so match the API value case-insensitively.
    const name = env.searchResults[0].name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(rows.first()).toContainText(new RegExp(name, 'i'));
    await expect(rows.first().getByRole('tab', { name: /Details/ })).toBeVisible();
    await expect(rows.first().getByRole('tab', { name: 'Documents' })).toBeVisible();

    const counts = await pageCount(page);
    expect(counts.total).toBe(total(env));
  });
});

test.describe('cac-unsubscribe', () => {
  test('renders the unsubscribe form without submitting it', async ({ page }) => {
    await page.goto('/cac-unsubscribe');
    await ready(page, 500);

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Unsubs?cribe from Community Advisory Committee/,
      }),
    ).toBeVisible();
    await expect(page.locator('#emailInput')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    // Deliberately no click: this endpoint mutates real subscriptions.
  });
});
