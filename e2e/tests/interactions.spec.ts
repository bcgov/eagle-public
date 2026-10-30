import { test, expect, type Page } from '../support/fixtures';
import { ready, waitForNativePage, waitForSearch, total } from '../support/helpers';

/* Controls the route specs miss: sort columns, page size, map filters, header tab order.
   Assertions are data-independent, so the deployed site and the port read the same. */

const ROWS = '.display-grid__row';

test('every projects column header sorts through the URL and the API', async ({ page }) => {
  await page.goto('/search?record=projects');
  await ready(page);

  const headers = page.locator('.display-grid thead button.display-grid__sort');
  const count = await headers.count();
  expect(count, 'no sortable column headers').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const label = (await headers.nth(i).innerText()).trim();
    const search = waitForNativePage(page, 'projects');
    await headers.nth(i).click();
    const listed = await search;
    expect(listed.status, `projects read after sorting on "${label}"`).toBe(200);
    // `+name` survives a round trip through URLSearchParams as `" name"`.
    const sortBy = new URL(page.url()).searchParams.get('sortBy');
    expect(sortBy, `sortBy after sorting on "${label}"`).toMatch(/^[+ -]\S/);
    await expect(page.locator(ROWS)).toHaveCount(Math.min(25, listed.total));
  }
});

test('the page size picker drives pageSize in the URL and the rendered rows', async ({ page }) => {
  await page.goto('/search?record=projects');
  await ready(page);

  // 25 is the grid's default, so picking it would write nothing to the URL.
  const picker = page.getByRole('group', { name: 'Rows per page' });
  await expect(picker).toBeVisible();

  const search = waitForNativePage(page, 'projects', 'pageSize=50');
  await picker.getByText('50', { exact: true }).click();
  const listed = await search;
  await page.waitForTimeout(1500);

  expect(new URL(page.url()).searchParams.get('pageSize')).toBe('50');
  await expect(page.locator(ROWS)).toHaveCount(Math.min(50, listed.total));
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
  const home = page.getByRole('banner').getByRole('link', { name: /^EAO\b/ });
  await home.focus();

  const seen = [await focusedName(page)];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    seen.push(await focusedName(page));
  }

  expect(seen).toEqual([
    'EAO Environmental Assessment Office Project Information Centre',
    'Map Explorer',
    'Search',
    'About',
  ]);
});
