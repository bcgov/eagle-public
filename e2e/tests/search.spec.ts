import { test, expect } from '../support/fixtures';
import { ready, recordApiCalls, checkBaseline, waitForSearch, total, pageCount } from '../support/helpers';

const ROWS = 'table[aria-label="table-template"] tbody tr';
const NAME = 'td[data-label="Name"]';

test('search renders the document table and the API it came from', async ({ page }) => {
  const calls = recordApiCalls(page);
  const search = waitForSearch(page, 'Document');
  await page.goto('/search');
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Search All Documents' })).toBeVisible();
  for (const col of ['Document Name', 'Project', 'Date', 'Type', 'Milestone']) {
    await expect(page.getByRole('columnheader', { name: new RegExp(`Column header ${col}`) })).toBeVisible();
  }

  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(Math.min(10, total(env)));
  await expect(rows.first().locator(NAME)).toHaveText(env.searchResults[0].displayName);

  const counts = await pageCount(page);
  expect(counts.shown).toBe(Math.min(10, total(env)));
  expect(counts.total).toBe(total(env));

  checkBaseline('search', calls);
});

test('@data a keyword search returns results and syncs the query params', async ({ page }) => {
  await page.goto('/search');
  await ready(page);
  const before = (await pageCount(page)).total;

  const search = waitForSearch(page, 'Document');
  await page.getByPlaceholder('Type keyword to search').fill('caribou');
  await page.getByRole('button', { name: /Search/ }).first().click();
  const env = await search;
  await page.waitForTimeout(1500);

  const params = new URL(page.url()).searchParams;
  expect(params.get('keywords')).toBe('caribou');
  expect(params.get('sortBy')).toBe('-score');

  const after = await pageCount(page);
  expect(after.total).toBe(total(env));
  expect(after.total).toBeGreaterThan(0);
  expect(after.total).toBeLessThan(before);
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
});

test('@data the Milestone facet narrows the results and adds a milestone query param', async ({ page }) => {
  await page.goto('/search');
  await ready(page);
  const before = (await pageCount(page)).total;

  await page.getByRole('button', { name: /Open Advanced Filters/ }).click();
  const facet = page.getByRole('combobox', { name: 'Type Milestone' });
  await facet.waitFor({ state: 'visible' });
  await facet.click();
  const option = page.getByRole('option').first();
  await option.waitFor();
  const label = (await option.innerText()).trim();

  const search = waitForSearch(page, 'Document');
  await option.click();
  const env = await search;
  await page.waitForTimeout(1500);

  const milestone = new URL(page.url()).searchParams.get('milestone');
  expect(milestone, `no milestone param after picking "${label}"`).toMatch(/^[0-9a-f]{24}$/i);

  // The facet list is alphabetical, so which milestone comes first - and whether this
  // environment's corpus has any document under it - is data, not behaviour.
  const filtered = total(env);
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, filtered));
  if (filtered === 0) {
    await expect(page.getByText('No results found')).toBeVisible();
  } else {
    const after = await pageCount(page);
    expect(after.total).toBe(filtered);
    expect(after.total).toBeLessThan(before);
  }
});

test('pagination moves to page 2 and reflects it in the URL', async ({ page }) => {
  await page.goto('/search');
  await ready(page);

  const first = page.locator(ROWS).first().locator(NAME);
  const page1 = await first.innerText();

  const search = waitForSearch(page, 'Document');
  await page.getByRole('button', { name: 'Go to page 2' }).first().click();
  const env = await search;

  expect(new URL(page.url()).searchParams.get('currentPage')).toBe('2');
  await expect(first).not.toHaveText(page1);
  await expect(first).toHaveText(env.searchResults[0].displayName);
});

test('@data a deep link restores keywords, page and sort', async ({ page }) => {
  const req = page.waitForRequest(r => r.url().includes('dataset=Document') && r.url().includes('keywords=caribou'));
  const search = waitForSearch(page, 'Document');
  await page.goto('/search?keywords=caribou&currentPage=2&sortBy=-score');
  const env = await search;
  await ready(page);

  const wire = new URL((await req).url()).searchParams;
  expect(wire.get('keywords')).toBe('caribou');
  expect(wire.get('pageNum')).toBe('1');
  expect(wire.get('sortBy')).toBe('-score');

  await expect(page.getByPlaceholder('Type keyword to search')).toHaveValue('caribou');
  await expect(page.getByRole('button', { name: 'Go to page 2' }).first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator(ROWS).first().locator(NAME)).toHaveText(env.searchResults[0].displayName);
});

test('a search result row links to its project and offers a download control', async ({ page }) => {
  const search = waitForSearch(page, 'Document');
  await page.goto('/search');
  const env = await search;
  await ready(page);

  const row = page.locator(ROWS).first();
  await expect(row.getByRole('link', { name: `Link to project ${env.searchResults[0].project.name}` }))
    .toHaveAttribute('href', `/p/${env.searchResults[0].project._id}/project-details`);
  await expect(row.locator('td[data-label="Download"] .download-icon')).toBeVisible();
});
