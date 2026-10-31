import { test, expect, type Page } from '../support/fixtures';
import { projectsInView, ready, waitForNativePage } from '../support/helpers';

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

  await expect(page).toHaveURL((url) => url.searchParams.get('pageSize') === '50');
  await expect(page.locator(ROWS)).toHaveCount(Math.min(50, listed.total));
});

test('@data the map region filter keeps only that region and syncs the URL', async ({ page }) => {
  // No fly animation, so the count is read off a map that has stopped moving.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/projects');
  const count = page.locator('[data-testid="results-count"]');
  await expect(count).toHaveText(/^[1-9]\d* projects? in view$/, { timeout: 60_000 });
  const unfiltered = projectsInView(await count.innerText());

  await page.getByRole('button', { name: /Filters/ }).click();
  await page.locator('#region input, #region').first().click();
  const option = page.getByRole('option').first();
  const regionName = (await option.innerText()).trim();
  await option.click();

  await expect(page).toHaveURL((url) =>
    /^[0-9a-f]{24}$/i.test(url.searchParams.get('regions') ?? ''),
  );
  const regionCells = page.locator('[data-testid="project-card"] .app-card__meta:nth-child(4)');
  await expect(regionCells.filter({ hasNotText: regionName })).toHaveCount(0);
  await expect(regionCells).not.toHaveCount(0);
  await expect.poll(async () => projectsInView(await count.innerText())).toBeLessThan(unfiltered);
});

/** The text content of whatever holds focus, whitespace collapsed; image alt text is not in it. */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() =>
    (document.activeElement?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

test('the header tabs through its links in visual order', async ({ page }) => {
  await page.goto('/');
  await ready(page);

  // Start on the masthead's home link, so the skip link that sits ahead of the header does not
  // have to be counted. The Menu toggler is display:none at this viewport, so it is not a stop.
  const home = page
    .getByRole('banner')
    .getByRole('link', { name: 'EAO Project Information Centre', exact: true });
  await home.focus();

  const seen = [await focusedName(page)];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    seen.push(await focusedName(page));
  }

  expect(seen).toEqual(['EAO Project Information Centre', 'Map Explorer', 'Search', 'About']);
});
