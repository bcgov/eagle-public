import { test, expect, type Page } from '../support/fixtures';
import { ready, waitForSearch, total } from '../support/helpers';

/**
 * Controls the route specs do not reach: every sortable column rather than one, the page-size
 * picker, the map's advanced filters, keyboard order through the header, and Escape on the
 * comment modal. Every assertion is data-independent so the same run means the same thing on the
 * deployed site and on the port.
 */

const ROWS = 'table[aria-label="table-template"] tbody tr';

test('every projects-list column header sorts through the URL and the API', async ({ page }) => {
  await page.goto('/projects-list');
  await ready(page);

  const headers = page.locator('th.sortable button');
  const count = await headers.count();
  expect(count, 'no sortable column headers').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const label = (await headers.nth(i).innerText()).trim();
    const search = waitForSearch(page, 'Project');
    await headers.nth(i).click();
    const env = await search;
    // `+name` survives a round trip through URLSearchParams as `" name"`.
    const sortBy = new URL(page.url()).searchParams.get('sortBy');
    expect(sortBy, `sortBy after sorting on "${label}"`).toMatch(/^[+ -]\S/);
    await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
  }
});

test('the page size picker drives pageSize in the URL and the rendered rows', async ({ page }) => {
  await page.goto('/projects-list');
  await ready(page);

  const picker = page.locator('[id^="table-template-page-size-picker"]');
  await expect(picker).toBeVisible();

  const search = waitForSearch(page, 'Project', 'pageSize=25');
  await picker.getByText('25', { exact: true }).click();
  const env = await search;
  await page.waitForTimeout(1500);

  expect(new URL(page.url()).searchParams.get('pageSize')).toBe('25');
  await expect(page.locator(ROWS)).toHaveCount(Math.min(25, total(env)));
});

test('@data the map region filter narrows the result count and syncs the URL', async ({ page }) => {
  await page.goto('/projects');
  await ready(page, 4000);

  const before = await waitForSearch(page, 'Project').catch(() => null);
  const options = page.locator('[data-testid="results-count"]');
  const unfiltered = (await options.innerText()).trim();
  expect(unfiltered, 'no result count on the map').toMatch(/\d/);
  expect(before === null || total(before) >= 0).toBeTruthy();

  await page.getByRole('button', { name: /Filters/ }).click();
  const region = page.locator('#region input, #region').first();
  await region.click();
  const option = page.getByRole('option').first();
  await option.waitFor();
  await option.click();
  await page.waitForTimeout(2500);

  expect(
    new URL(page.url()).searchParams.get('regions'),
    'regions param after picking one',
  ).toMatch(/^[0-9a-f]{24}$/i);
  const filtered = (await options.innerText()).trim();
  expect(filtered).not.toBe(unfiltered);
});

/** The visible + screen-reader text of whatever holds focus, whitespace collapsed. */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() =>
    (document.activeElement?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

test('the header tabs through its links in visual order', async ({ page }) => {
  await page.goto('/');
  await ready(page, 1000);

  // Start on the masthead's home link, so the skip link that sits ahead of the header does not
  // have to be counted. The Menu toggler is display:none at this viewport, so it is not a stop.
  const home = page.getByRole('banner').getByRole('link', { name: /^EPIC\b/ });
  await home.focus();

  const seen = [await focusedName(page)];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    seen.push(await focusedName(page));
  }

  expect(seen).toEqual([
    'EPIC Environmental Assessment Office Project Information Centre',
    'Map Explorer',
    'Search',
    'Contact Us',
    'Staff Login (opens in new tab)',
  ]);
});

test('Escape closes the comment modal without submitting', async ({ page, request }) => {
  const list = await (
    await request.get(
      '/api/commentperiod?sortBy=-dateStarted&fields=project|dateStarted|dateCompleted',
    )
  ).json();
  const cp = list.find((c: any) => c.project && c.dateStarted && c.dateCompleted);
  expect(cp, 'no comment period on this environment').toBeTruthy();

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  const open = page.getByRole('button', { name: 'Submit Comment' }).first();
  test.skip(!(await open.count()), 'this comment period is not open');
  await open.click();

  const title = page.getByText('Submit a Comment', { exact: true });
  await expect(title).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(title).toHaveCount(0);
});
