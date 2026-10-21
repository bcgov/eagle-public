import { test, expect, type Page } from '../support/fixtures';
import { ready, recordApiCalls, checkBaseline } from '../support/helpers';

/**
 * The About page, search help and the home page. The activities and project-notification lists
 * used to live here too; they are record types on /search now, covered by `search.spec.ts`, and
 * their old addresses by `routing.spec.ts`.
 */

/** A jump leaves 24px above the section (`scroll-margin-top` in about.css); 8px either way allows
 * for rounding, so a jump that lost the offset fails. */
const LANDED_FROM = 16;
const LANDED_WITHIN = 32;
/** At 1400 wide the page is about 2500px tall with Compliance about 1130px down, so at this
 * height it bottoms out with Compliance well short of the top. */
const TALL_VIEWPORT = 1600;

function sectionTop(page: Page, id: string): Promise<number> {
  return page.evaluate((sid) => document.getElementById(sid)!.getBoundingClientRect().top, id);
}

/** Resolves once `scrollY` holds still for 200ms, so a smooth scroll and its rail pin have ended. */
async function scrollSettled(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const y = window.scrollY;
            setTimeout(() => resolve(window.scrollY === y), 200);
          }),
      ),
    )
    .toBe(true);
}

async function expectSectionAtTop(page: Page, id: string): Promise<void> {
  await expect.poll(() => sectionTop(page, id)).toBeLessThanOrEqual(LANDED_WITHIN);
  await scrollSettled(page);
  const top = await sectionTop(page, id);
  expect(top).toBeGreaterThanOrEqual(LANDED_FROM);
  expect(top).toBeLessThanOrEqual(LANDED_WITHIN);
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
    await expectSectionAtTop(page, 'compliance');
    // Checked once the jump has settled: during it the pin alone marks the target.
    await expect(target).toHaveAttribute('aria-current', 'true');
    await expect(first).not.toHaveAttribute('aria-current');
    await expect(rail.locator('[aria-current]')).toHaveCount(1);
  });

  test.describe('on a viewport too tall to bring Compliance to the top', () => {
    test.use({ viewport: { width: 1400, height: TALL_VIEWPORT } });

    test('a rail click keeps Compliance current, not Contact, at the bottom of the page', async ({
      page,
    }) => {
      await page.goto('/about');
      await ready(page, 500);
      const rail = page.getByRole('navigation', { name: 'On this page' });
      const target = rail.getByRole('link', { name: 'Compliance oversight' });

      await target.click();
      await scrollSettled(page);

      expect(await sectionTop(page, 'compliance'), 'the page bottomed out short').toBeGreaterThan(
        LANDED_WITHIN,
      );
      await expect(target).toHaveAttribute('aria-current', 'true');
      await expect(rail.locator('[aria-current]')).toHaveCount(1);
    });
  });

  test('links that leave the tab say so and cut the opener', async ({ page }) => {
    await page.goto('/about');
    const content = page.getByRole('main');
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
    const form = content.getByRole('link', {
      name: 'Report a natural resource violation (opens in new tab)',
    });
    await expect(form).toHaveAttribute(
      'href',
      'https://forms.gov.bc.ca/industry/report-a-natural-resource-violation',
    );
    await expect(form).toHaveAttribute('target', '_blank');
  });

  const CONTACT_LINKS: [string, string][] = [
    ['Submit your feedback', 'mailto:EAO.EPICsystem@gov.bc.ca'],
    ['EAOinfo@gov.bc.ca', 'mailto:EAOinfo@gov.bc.ca'],
    ['Questions about a specific project?', 'mailto:EAO.Operations@gov.bc.ca'],
    ['250-387-0131', 'tel:+1-250-387-0131'],
    ['Email EAO Compliance', 'mailto:EAO.Compliance@gov.bc.ca'],
  ];

  for (const [name, href] of CONTACT_LINKS) {
    test(`contact link "${name}" opens ${href} in the same tab`, async ({ page }) => {
      await page.goto('/about');
      const link = page.locator('section#contact').getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).not.toHaveAttribute('target');
    });
  }
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

    // The projects-by-type band reads only once it is within 200px of the viewport, so the
    // baseline holds while the band sits more than 200px below this 900px fold.
    // The rail reads the closed count only when no period is open, which depends on the data.
    calls.delete('GET /demi/api/comment-periods?pageSize=100&sort=-dateCompleted&status=closed');
    checkBaseline('home', calls);
  });

  test('an About row opens its section of the About page, with focus on its heading', async ({
    page,
  }) => {
    await page.goto('/');
    await ready(page, 500);

    await page
      .getByRole('region', { name: 'About', exact: true })
      .getByRole('link', { name: /^Legislation / })
      .click();

    await expect(page).toHaveURL(/\/about#legislation$/);
    await expect(page.locator('section#legislation')).toBeInViewport();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Legislation', exact: true }),
    ).toBeFocused();
  });

  test('the reader links back to the Updates heading, and Back from a card keeps the card focused', async ({
    page,
  }) => {
    // An id with no visible Update opens the reader on its "no longer available" note.
    await page.goto('/updates/no-such-update');
    await page.getByRole('link', { name: 'See recent updates' }).click();

    await expect(page).toHaveURL(/\/#home-updates-heading$/);
    const heading = page.getByRole('heading', { level: 2, name: 'Updates', exact: true });
    // The reader's scroll lock lets go as the page scrolls to the heading; it must still land.
    await expect(heading).toBeInViewport();
    await expect(heading).toBeFocused();

    const card = page.locator('.home-update[href^="/updates/"]').first();
    await card.click();
    await expect(page.locator('.home-reader[open]')).toBeVisible();
    await page.goBack();

    await expect(page).toHaveURL(/\/#home-updates-heading$/);
    await expect(card).toBeFocused();
    await expect(heading).not.toBeFocused();
  });

  /** The rows of the home page's one `/updates/feed` read. */
  function feedRows(page: Page): Promise<any[]> {
    return page
      .waitForResponse(
        (r) => new URL(r.url()).pathname.endsWith('/demi/api/updates/feed') && r.status() === 200,
        { timeout: 60_000 },
      )
      .then((r) => r.json());
  }

  // eagle-demi answers the feed in display order: pinned updates, then updates and decisions
  // newest first. The page shows every row it gets, in that order.
  test('@data feed cards come from the /updates/feed read', async ({ page }) => {
    const feedRead = feedRows(page);
    await page.goto('/');
    const rows = (await feedRead).filter((row: any) => row.id);
    await ready(page);

    const cards = page.getByRole('region', { name: 'Updates' }).locator('.home-update');
    expect(rows.length).toBeGreaterThan(0);
    await expect(cards).toHaveCount(rows.length);
    // An update card heads with the short headline, else the headline; a decision with the decision.
    const title = (row: any): string => {
      if (row.kind === 'projects') return row.eacDecision.name;
      if (row.kind === 'notifications') return row.decision;
      return row.shortHeadline?.trim() || row.headline.trim();
    };
    await expect(cards.first()).toContainText(title(rows[0]));
    await expect(cards.last()).toContainText(title(rows[rows.length - 1]));
  });

  test('@data an update card opens the reader at /updates/:id and Close returns home', async ({
    page,
  }) => {
    const feedRead = feedRows(page);
    await page.goto('/');
    const update = (await feedRead).find((row: any) => row.kind === 'updates');
    expect(update, 'the /updates/feed read holds no update to open').toBeDefined();
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
