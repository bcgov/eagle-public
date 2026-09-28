import { test, expect, type Page } from '../support/fixtures';
import { ready, recordApiCalls, checkBaseline, waitForSearch } from '../support/helpers';

/**
 * The About page, search help and the home page. The activities and project-notification lists
 * used to live here too; they are record types on /search now, covered by `search.spec.ts`, and
 * their old addresses by `routing.spec.ts`.
 */

/** A jump leaves 24px above the section; 40 allows for rounding and a scroll still settling. */
const LANDED_WITHIN = 40;

function sectionTop(page: Page, id: string): Promise<number> {
  return page.evaluate((sid) => document.getElementById(sid)!.getBoundingClientRect().top, id);
}

async function expectSectionAtTop(page: Page, id: string): Promise<void> {
  await expect.poll(() => sectionTop(page, id)).toBeLessThanOrEqual(LANDED_WITHIN);
  expect(await sectionTop(page, id)).toBeGreaterThanOrEqual(0);
}

test.describe('about page', () => {
  test('holds the four former pages as sections, in reading order', async ({ page }) => {
    await page.goto('/about');
    await expect(
      page.getByRole('heading', { level: 1, name: 'About environmental assessment' }),
    ).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
      'The assessment process',
      'Legislation',
      'Compliance oversight',
      'Contact us',
    ]); // The ids are the redirect targets, so each must name its own heading.
    await expect(page.locator('section#process h2')).toHaveText('The assessment process');
    await expect(page.locator('section#legislation h2')).toHaveText('Legislation');
    await expect(page.locator('section#compliance h2')).toHaveText('Compliance oversight');
    await expect(page.locator('section#contact h2')).toHaveText('Contact us');
  });

  const REDIRECTS: [string, string][] = [
    ['/process', 'process'],
    ['/legislation', 'legislation'],
    ['/compliance-oversight', 'compliance'],
    ['/contact', 'contact'],
  ];

  for (const [route, section] of REDIRECTS) {
    test(`${route} lands on /about#${section} with the section at the top`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/about#${section}$`));
      await expectSectionAtTop(page, section);
    });
  }

  test('a rail link marks itself current and scrolls to its section', async ({ page }) => {
    await page.goto('/about');
    await ready(page, 500);
    const rail = page.getByRole('navigation', { name: 'On this page' });
    const first = rail.getByRole('link', { name: 'The assessment process' });
    const target = rail.getByRole('link', { name: 'Compliance oversight' });
    await expect(first).toHaveAttribute('aria-current', 'true');

    await target.click();
    await expect(target).toHaveAttribute('aria-current', 'true');
    await expect(first).not.toHaveAttribute('aria-current');
    await expect(rail.locator('[aria-current]')).toHaveCount(1);
    await expectSectionAtTop(page, 'compliance');
  });

  test('links that leave the tab say so and cut the opener', async ({ page }) => {
    await page.goto('/about');
    const content = page.getByRole('main');
    // Two rows per Act card, the compliance policies link, and two of the three contact cards.
    await expect(content.locator('a[target="_blank"]')).toHaveCount(7);
    await expect(
      content.locator('a[target="_blank"]:not([rel="noopener noreferrer"])'),
    ).toHaveCount(0);

    await expect(
      content.getByRole('link', { name: 'The Act and regulations (2018 Act) (opens in new tab)' }),
    ).toHaveAttribute('target', '_blank');
    await expect(
      content.getByRole('link', {
        name: 'View Compliance & Enforcement Policies and Procedures (opens in new tab)',
      }),
    ).toHaveAttribute('target', '_blank');
    await expect(
      content.getByRole('link', {
        name: 'Visit EAO B.C. Government Directory (opens in new tab)',
      }),
    ).toHaveAttribute('target', '_blank');
  });

  test('the feedback link opens a mail to the EPIC mailbox in the same tab', async ({ page }) => {
    await page.goto('/about');
    const feedback = page.getByRole('main').getByRole('link', { name: 'Submit your Feedback' });
    await expect(feedback).toHaveAttribute('href', 'mailto:EAO.EPICsystem@gov.bc.ca');
    await expect(feedback).not.toHaveAttribute('target');
  });
});

test.describe('search help', () => {
  test('/search-help renders "Advanced Search Help"', async ({ page }) => {
    await page.goto('/search-help');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Advanced Search Help' }),
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
