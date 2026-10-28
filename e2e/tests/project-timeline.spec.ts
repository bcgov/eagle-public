import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '../support/fixtures';

/**
 * The project Timeline tab on live DEMI test data for Cariboo Gold (project 45): a 2002 Act history
 * transitioned to the 2018 Act with no recorded date, a certificate in 2023 and two open amendments.
 */

const CARIBOO = '5d40cc5b4cb2c7001b1336b8';
const TIMELINE = `/p/${CARIBOO}/timeline`;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** The list row whose `li` carries this item id. */
const row = (page: Page, id: string) =>
  page.locator(`.timeline-list > li[data-id="${id}"] .timeline-list__button`);

async function openTimeline(page: Page, search = '') {
  await page.goto(`${TIMELINE}${search}`);
  await expect(page.getByRole('list', { name: 'Timeline, oldest first' })).toBeVisible({
    timeout: 60_000,
  });
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });

  test('the summary rail links to the Timeline tab', async ({ page }) => {
    await page.goto(`/p/${CARIBOO}/overview`);
    await page.getByRole('link', { name: 'View timeline' }).click();

    await expect(page).toHaveURL(new RegExp(`/p/${CARIBOO}/timeline$`));
    await expect(page.getByRole('heading', { level: 2, name: 'Timeline' })).toBeVisible();
    await expect(page.locator('.project-tabs nav a[aria-current="page"]')).toHaveText(/^Timeline/);
  });

  test('an Act transition with no recorded date says so', async ({ page }) => {
    await openTimeline(page);

    const transition = row(page, 'transition-2002-2018');
    await expect(transition).toContainText('Transitioned to the 2018 Act');
    await expect(transition).toContainText('Date: Not recorded');
  });

  test('arrow keys move focus between rows and Enter selects', async ({ page }) => {
    await openTimeline(page);
    // The first open work is selected on arrival, so it is the row in the Tab order.
    await row(page, 'work-123').focus();

    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'work-333')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]item=work-333/);

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(row(page, 'certificate')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]item=certificate/);
    await expect(row(page, 'certificate')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 'work-333')).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.getByRole('complementary', { name: 'Selected item' }).getByRole('heading', { level: 3 }),
    ).toHaveText('Environmental Assessment Certificate issued');
  });

  test('?item= preselects that row and opens its folded group', async ({ page }) => {
    // Pre-EA is dated by its documents; Pre-Application is the one undated 2002 phase.
    await openTimeline(page, '?item=phase-2002-pre-application');

    await expect(row(page, 'history-2002')).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, 'phase-2002-pre-application')).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('complementary', { name: 'Selected item' }).getByRole('heading', { level: 3 }),
    ).toHaveText('Pre-Application');
  });

  test('an unknown ?item= falls back to the first open work', async ({ page }) => {
    await openTimeline(page, '?item=no-such-item');

    await expect(row(page, 'work-123')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the lanes heading names the years of the list rows in view', async ({ page }) => {
    await openTimeline(page);
    const list = page.locator('.timeline-list');
    const heading = page.locator('.timeline-lanes__heading');
    const thisYear = new Date().getFullYear();

    // The top rows are the 2002 Act band (in force 30 Dec 2002) and its history.
    await list.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(heading).toHaveText(/list showing 2002 – (?!2002)\d{4}$/);

    // The bottom row is Today; the 2002 band is out of view.
    await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(heading).toHaveText(new RegExp(`list showing (?!2002)\\d{4} – ${thisYear}$`));
  });

  test('dragging the strip of the list box on the lanes scrolls the list', async ({ page }) => {
    await openTimeline(page);
    const list = page.locator('.timeline-list');
    await list.evaluate((element) => element.scrollTo({ top: 0 }));
    const handle = page.locator('.timeline-lanes__window-handle');
    await handle.scrollIntoViewIfNeeded();
    await expect(list).toHaveJSProperty('scrollTop', 0);
    const box = (await handle.boundingBox())!;
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 300, y, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test('dragging the view box on the mini-map moves the zoomed view', async ({ page }) => {
    await openTimeline(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const slider = page.getByRole('slider', { name: 'View on the whole life' });
    await expect(slider).toHaveAttribute('aria-valuenow', '50');
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    // Half the mini-map is the whole way left at this zoom; the view stops at the start.
    await page.mouse.move(box.x + box.width / 2 - box.width, y, { steps: 10 });
    await page.mouse.up();

    await expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  test('a phase with over 50 documents links to all of them by phase tag', async ({ page }) => {
    await openTimeline(page, '?item=phase-6');

    const all = page
      .getByRole('complementary', { name: 'Selected item' })
      .getByRole('link', { name: /^View all \d+ documents/ });
    await expect(all).toHaveAttribute(
      'href',
      new RegExp(`^/p/${CARIBOO}/documents\\?projectPhase=[0-9a-f]{24}(%2C[0-9a-f]{24})*$`),
    );
  });
});

test.describe('phone', () => {
  test.use({ viewport: PHONE });

  test('the selected row opens its details inline, and a second tap folds them', async ({
    page,
  }) => {
    await openTimeline(page, '?item=certificate');

    const certificate = page.locator('.timeline-list > li[data-id="certificate"]');
    await expect(row(page, 'certificate')).toHaveAttribute('aria-expanded', 'true');
    await expect(certificate.getByRole('heading', { level: 3 })).toHaveText(
      'Environmental Assessment Certificate issued',
    );
    // Inline only: no side panel beside the list.
    await expect(page.getByRole('complementary', { name: 'Selected item' })).toHaveCount(1);

    await row(page, 'certificate').click();
    await expect(row(page, 'certificate')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('complementary', { name: 'Selected item' })).toHaveCount(0);

    await row(page, 'phase-3').click();
    await expect(
      page.locator('.timeline-list > li[data-id="phase-3"]').getByRole('heading', { level: 3 }),
    ).toHaveText('Readiness Decision');
  });
});

for (const [name, viewport] of [
  ['1440px', DESKTOP],
  ['390px', PHONE],
] as const) {
  test(`the Timeline tab has no WCAG 2.2 A/AA axe violations at ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openTimeline(page);

    const results = await new AxeBuilder({ page })
      .include('.timeline-tab')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const found = results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
    expect(found).toEqual([]);
  });
}
