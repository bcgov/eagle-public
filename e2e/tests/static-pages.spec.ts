import { test, expect } from '../support/fixtures';
import { ready, recordApiCalls, checkBaseline, waitForSearch } from '../support/helpers';

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
  test('shows the updates feed, the rail and the Browse strip', async ({ page }) => {
    const calls = recordApiCalls(page);
    await page.goto('/');
    await ready(page);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
    ).toBeVisible();
    const feed = page.getByRole('region', { name: 'Updates' });
    await expect(feed.getByRole('heading', { level: 2, name: 'Updates' })).toBeVisible();
    await expect(feed.locator('.home-update')).not.toHaveCount(0);
    await expect(feed.getByRole('link', { name: /View all Activities & Updates/ })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Open for comment' }).getByRole('heading', { level: 2 }),
    ).toHaveText('Open for comment');
    await expect(
      page.getByRole('region', { name: 'Recent Uploads' }).getByRole('heading', { level: 2 }),
    ).toHaveText('Recent Uploads');

    // The strip is the only way into these three pages; the masthead does not link them.
    const browse = page.getByRole('navigation', { name: 'Browse' });
    await expect(browse.getByRole('link', { name: 'The assessment process' })).toHaveAttribute(
      'href',
      '/process',
    );
    await expect(browse.getByRole('link', { name: 'Legislation' })).toHaveAttribute(
      'href',
      '/legislation',
    );
    await expect(browse.getByRole('link', { name: 'Compliance oversight' })).toHaveAttribute(
      'href',
      '/compliance-oversight',
    );

    checkBaseline('home', calls);
  });

  // eagle-demi answers the feed in display order: pinned updates, then updates and decisions
  // newest first. The page shows every row it gets, in that order.
  test('@data feed cards come from the HomeFeed read', async ({ page }) => {
    const feedRead = waitForSearch(page, 'HomeFeed');
    await page.goto('/');
    const rows = (await feedRead).searchResults.filter((row: any) => row.id);
    await ready(page);

    const cards = page.getByRole('region', { name: 'Updates' }).locator('.home-update');
    expect(rows.length).toBeGreaterThan(0);
    await expect(cards).toHaveCount(rows.length);
    await expect(cards.first()).toContainText(rows[0].headline.trim());
    await expect(cards.last()).toContainText(rows[rows.length - 1].headline.trim());
  });

  test('@data an update card opens the reader at /updates/:id and Close returns home', async ({
    page,
  }) => {
    const feedRead = waitForSearch(page, 'HomeFeed');
    await page.goto('/');
    const update = (await feedRead).searchResults.find((row: any) => row.kind === 'update');
    expect(update, 'the HomeFeed read holds no update to open').toBeDefined();
    await ready(page);

    await page
      .getByRole('region', { name: 'Updates' })
      .locator(`a[href="/updates/${encodeURIComponent(update.id)}"]`)
      .click();
    await expect(page).toHaveURL(new RegExp(`/updates/${update.id}$`));
    const reader = page.getByRole('dialog', { name: update.headline.trim() });
    await expect(reader).toBeVisible();

    await reader.getByRole('button', { name: 'Close' }).click();
    await expect(reader).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
