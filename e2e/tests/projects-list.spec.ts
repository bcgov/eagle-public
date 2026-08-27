import { test, expect } from '@playwright/test';
import { ready, recordApiCalls, checkBaseline, waitForSearch, total, pageCount } from '../support/helpers';

const ROWS = 'table[aria-label="table-template"] tbody tr';
const NAME = 'td[data-label="Name"]';

test('projects-list renders the table and the API it came from', async ({ page }) => {
  const calls = recordApiCalls(page);
  const search = waitForSearch(page, 'Project');
  await page.goto('/projects-list');
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Search Environmental Assessment Projects' })).toBeVisible();
  for (const col of ['Name', 'Proponent', 'Type', 'Region', 'Phase', 'Decision']) {
    await expect(page.getByRole('columnheader', { name: new RegExp(`Column header ${col}`) })).toBeVisible();
  }

  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(Math.min(10, total(env)));
  await expect(rows.first().locator(NAME)).toHaveText(env.searchResults[0].name);

  const counts = await pageCount(page);
  expect(counts.shown).toBe(Math.min(10, total(env)));
  expect(counts.total).toBe(total(env));

  checkBaseline('projects-list', calls);
});

test('sorting by Name flips the order and the sortBy query param', async ({ page }) => {
  await page.goto('/projects-list');
  await ready(page);

  const first = page.locator(ROWS).first().locator(NAME);
  const ascending = await first.innerText();

  const search = waitForSearch(page, 'Project');
  await page.getByRole('columnheader', { name: /Column header Name sortable/ }).click();
  await search;
  await expect(first).not.toHaveText(ascending);

  expect(new URL(page.url()).searchParams.get('sortBy')).toBe('-name');
  expect(await first.innerText()).not.toBe(ascending);
});

test('pagination moves to page 2 and reflects it in the URL', async ({ page }) => {
  await page.goto('/projects-list');
  await ready(page);

  const first = page.locator(ROWS).first().locator(NAME);
  const page1 = await first.innerText();

  const search = waitForSearch(page, 'Project');
  await page.getByRole('button', { name: 'Go to page 2' }).first().click();
  const env = await search;

  expect(new URL(page.url()).searchParams.get('currentPage')).toBe('2');
  await expect(first).not.toHaveText(page1);
  await expect(first).toHaveText(env.searchResults[0].name);
});

test('@data a keyword filter narrows the rows and syncs the query params', async ({ page }) => {
  await page.goto('/projects-list');
  await ready(page);
  const before = (await pageCount(page)).total;

  const search = waitForSearch(page, 'Project');
  await page.getByPlaceholder('Type keyword to search').fill('coal');
  await page.getByRole('button', { name: /^search Search$|Search/ }).first().click();
  const env = await search;
  await page.waitForTimeout(1500);

  const params = new URL(page.url()).searchParams;
  expect(params.get('keywords')).toBe('coal');
  expect(params.get('sortBy')).toBe('-score');
  expect(params.get('currentPage')).toBe('1');

  const after = await pageCount(page);
  expect(after.total).toBe(total(env));
  expect(after.total).toBeLessThan(before);
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
});

test('@data a deep link restores keywords, page and sort', async ({ page }) => {
  const req = page.waitForRequest(r => r.url().includes('dataset=Project') && r.url().includes('keywords=coal'));
  const search = waitForSearch(page, 'Project');
  await page.goto('/projects-list?keywords=coal&currentPage=2&sortBy=-score');
  const env = await search;
  await ready(page);

  // currentPage is 1-based in the URL, pageNum is 0-based on the wire.
  const wire = new URL((await req).url()).searchParams;
  expect(wire.get('keywords')).toBe('coal');
  expect(wire.get('pageNum')).toBe('1');
  expect(wire.get('sortBy')).toBe('-score');

  await expect(page.getByPlaceholder('Type keyword to search')).toHaveValue('coal');
  await expect(page.getByRole('button', { name: 'Go to page 2' }).first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator(ROWS).first().locator(NAME)).toHaveText(env.searchResults[0].name);
});
