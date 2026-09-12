import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { test, expect, type Page } from '../support/fixtures';
import {
  checkBaseline,
  gridCount,
  ready,
  recordApiCalls,
  total,
  waitForSearch,
} from '../support/helpers';

/**
 * The one search page at /search: the keyword field, the record-type pills, and the display grid
 * the chosen record type configures.
 *
 * Most tests answer every backend read from `e2e/fixtures/unified-search`, the same rows the parity
 * gate uses, so a count or a row order is an assertion rather than whatever the environment holds
 * today. The first test is the exception: it runs against the real backend, because the calls the
 * page makes are the thing it pins. Legacy /projects-list and Angular /search links live in
 * `routing.spec.ts`.
 */

const ROWS = '.display-grid__row';
/** The first data cell of a row. A selectable table puts its checkbox cell ahead of it. */
const NAME = 'td.display-grid__cell:not(.display-grid__cell--select)';

/** Fixture-backed page: deterministic rows, and nothing leaves the box. */
async function openSearch(page: Page, url = '/search'): Promise<void> {
  await routeDemiSearch(page);
  await page.goto(url);
  await page.locator('.display-grid').waitFor({ state: 'visible' });
}

function pill(page: Page, label: string) {
  return page.locator('[data-tour="types"] button').filter({ hasText: label });
}

function keywordField(page: Page) {
  return page.getByPlaceholder('Search projects, documents and updates');
}

test('the projects tab lists projects from the search API', async ({ page }) => {
  const calls = recordApiCalls(page);
  const search = waitForSearch(page, 'Project');
  await page.goto('/search');
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  for (const column of ['Project', 'Last updated', 'Proponent', 'Type', 'Region', 'Phase']) {
    await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  }

  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(Math.min(25, total(env)));
  await expect(rows.first().locator(NAME).first()).toHaveText(env.searchResults[0].name);
  expect((await gridCount(page)).total).toBe(total(env));

  checkBaseline('search', calls);
});

test('every record pill carries its own count for the typed keyword', async ({ page }) => {
  await openSearch(page);
  await keywordField(page).fill('mine');

  await expect(pill(page, 'Projects').locator('.unified-search__pill-count')).toHaveText('4');
  await expect(pill(page, 'Documents').locator('.unified-search__pill-count')).toHaveText('0');
  await expect(
    pill(page, 'Activities & updates').locator('.unified-search__pill-count'),
  ).toHaveText('1');
  await expect(
    pill(page, 'Project notifications').locator('.unified-search__pill-count'),
  ).toHaveText('2');
});

test('a keyword narrows the rows and lands in the URL', async ({ page }) => {
  await openSearch(page);
  await keywordField(page).fill('coal');

  await expect(page.locator(ROWS)).toHaveCount(1);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Sukunka Coal');
  await expect(page).toHaveURL(/[?&]keywords=coal(&|$)/);
  expect(await gridCount(page)).toEqual({ first: 1, last: 1, total: 1 });
});

test('a column header sorts the rows, and a second click reverses them', async ({ page }) => {
  await openSearch(page);
  const header = page.getByRole('columnheader', { name: 'Project', exact: true });
  const firstName = page.locator(ROWS).first().locator(NAME).first();

  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  // `+name` goes on the wire unencoded, so a URL parser reads it back as " name".
  expect(new URL(page.url()).searchParams.get('sortBy')).toMatch(/^[+ ]name$/);

  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(new URL(page.url()).searchParams.get('sortBy')).toBe('-name');
  await expect(firstName).toHaveText('Willow Creek Wind');
});

test('a deep link restores the keyword, the sort and the page size', async ({ page }) => {
  await openSearch(page, '/search?keywords=mine&sortBy=-name&pageSize=10');

  await expect(keywordField(page)).toHaveValue('mine');
  await expect(page.locator(ROWS)).toHaveCount(4);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Sukunka Coal');
  expect(await gridCount(page)).toEqual({ first: 1, last: 4, total: 4 });
});

test('pagination moves to the second page and records it in the URL', async ({ page }) => {
  await openSearch(page, '/search?pageSize=10');
  await expect(page.locator(ROWS)).toHaveCount(10);

  await page.getByRole('button', { name: 'Go to page 2' }).first().click();

  expect(new URL(page.url()).searchParams.get('currentPage')).toBe('2');
  await expect(page.locator(ROWS)).toHaveCount(2);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Willow Creek Wind');
  expect(await gridCount(page)).toEqual({ first: 11, last: 12, total: 12 });
});

test('a filter in the header row narrows the rows to that value', async ({ page }) => {
  await openSearch(page);
  await page.locator('[data-tour="filterrow"] button[aria-label="Filter by Region"]').click();
  await page.getByRole('group', { name: 'Filter by Region' }).getByText('Skeena').click();

  expect(new URL(page.url()).searchParams.get('region')).toBe('Skeena');
  await expect(page.locator(ROWS)).toHaveCount(5);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Cedar LNG');
});

test('copy link puts the address of the current view on the clipboard', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openSearch(page, '/search?keywords=mine&sortBy=-name');
  const copy = page.locator('[data-tour="copy"]');

  await copy.click();

  // The button carries a Material Icons ligature next to its label, so the label is a substring.
  await expect(copy).toContainText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test('the documents pill switches the grid to the document columns', async ({ page }) => {
  await openSearch(page);
  await pill(page, 'Documents').click();

  expect(new URL(page.url()).searchParams.get('record')).toBe('documents');
  for (const column of [
    'Name',
    'Date posted',
    'Document type',
    'Milestone',
    'Project phase',
    'Author',
  ]) {
    await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  }
  await expect(page.locator(ROWS)).toHaveCount(18);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText(
    'Amendment #3 Application — Volume 1',
  );
});

test('selecting a document offers it for download', async ({ page }) => {
  await openSearch(page, '/search?record=documents');
  const firstRow = page.locator(ROWS).first();
  await expect(firstRow.locator(NAME).first()).toHaveText('Amendment #3 Application — Volume 1');

  await firstRow.getByRole('checkbox').check();

  await expect(page.locator('.display-grid__count')).toHaveText('1 selected');
  await expect(page.getByRole('button', { name: 'Download 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  expect(await gridCount(page)).toEqual({ first: 1, last: 18, total: 18 });
});
