import { test, expect } from '../support/fixtures';
import { ready, latestCommentPeriod, searchFixture } from '../support/helpers';

/** The record-type pill the page is showing, whichever label that type carries. */
function activePill(page: import('@playwright/test').Page) {
  return page.locator('[data-tour="types"] button[aria-pressed="true"]');
}

test('an unknown route falls back to the home page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await ready(page);

  expect(new URL(page.url()).pathname).toBe('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
  ).toBeVisible();
});

test('/p/:projId/cp/:cpId redirects to /details', async ({ page, request }) => {
  const cp = await latestCommentPeriod(request);

  await page.goto(`/p/${cp.project}/cp/${cp._id}`);
  await page.waitForURL(`**/p/${cp.project}/cp/${cp._id}/details`);
  expect(new URL(page.url()).pathname).toBe(`/p/${cp.project}/cp/${cp._id}/details`);
});

test('@data /pn/:projId/cp/:cpId redirects to /details', async ({ page, request }) => {
  const notifications = await searchFixture(
    request,
    'dataset=ProjectNotification&pageNum=0&pageSize=25&projectLegislation=default&sortBy=-notificationReceivedDate&populate=true&fuzzy=false',
  );

  let pn: any, cp: any;
  for (const n of notifications) {
    const periods = await searchFixture(
      request,
      `and[project]=${n._id}&dataset=CommentPeriod&pageNum=0&pageSize=1&projectLegislation=default&sortBy=-dateStarted&populate=false&fuzzy=false`,
    );
    if (periods.length) {
      pn = n;
      cp = periods[0];
      break;
    }
  }
  test.skip(!pn, 'no project notification with a comment period on this environment');

  await page.goto(`/pn/${pn._id}/cp/${cp._id}`);
  await page.waitForURL(`**/pn/${pn._id}/cp/${cp._id}/details`);
  expect(new URL(page.url()).pathname).toBe(`/pn/${pn._id}/cp/${cp._id}/details`);
});

test('/search/content lands on the documents tab, scoped inside the documents', async ({
  page,
}) => {
  await page.goto('/search/content?keywords=water&currentPage=2');
  await page.waitForURL('**/search?*');

  const url = new URL(page.url());
  expect(url.pathname).toBe('/search');
  expect(url.searchParams.get('record')).toBe('documents');
  expect(url.searchParams.get('scope')).toBe('inside');
  expect(url.searchParams.get('keywords')).toBe('water');
  expect(url.searchParams.get('currentPage')).toBe('2');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
});

// One Angular-era list page end to end; `routes.spec.ts` holds the redirect table for all of them.
test('/projects-list lands on unified search as projects', async ({ page }) => {
  await page.goto('/projects-list?keywords=coal&currentPage=2');
  await page.waitForURL('**/search?*');

  const url = new URL(page.url());
  expect(url.pathname).toBe('/search');
  expect(url.searchParams.get('record')).toBe('projects');
  expect(url.searchParams.get('keywords')).toBe('coal');
  await expect(activePill(page)).toHaveText(/projects/i);
});

// An Angular /search meant documents. With a document-only param on it, the page has to open on
// the documents tab rather than the default projects one.
test('an Angular document search opens the documents tab', async ({ page }) => {
  await page.goto('/search?keywords=coal&milestone=whatever');
  await page.waitForURL('**/search?record=documents*');

  const url = new URL(page.url());
  expect(url.searchParams.get('record')).toBe('documents');
  expect(url.searchParams.get('keywords')).toBe('coal');
});

test('an old hash-router address re-enters the path routes', async ({ page }) => {
  await page.goto('/#/projects-list?keywords=coal');
  await page.waitForURL('**/search?*');

  const url = new URL(page.url());
  expect(url.pathname).toBe('/search');
  expect(url.searchParams.get('record')).toBe('projects');
  expect(url.searchParams.get('keywords')).toBe('coal');
  await expect(activePill(page)).toHaveText(/projects/i);
});

test('the header navigates to every top-level destination', async ({ page }) => {
  await page.goto('/');
  await ready(page);

  await page.getByRole('banner').getByRole('link', { name: 'Map Explorer' }).click();
  await page.waitForURL('**/projects');

  await page.goto('/');
  await ready(page);
  await page.getByRole('banner').getByRole('link', { name: 'About', exact: true }).click();
  await page.waitForURL('**/about');

  await page.goto('/');
  await ready(page);
  const search = page.getByRole('banner').getByRole('link', { name: 'Search' });
  await search.click();
  await page.waitForURL('**/search?*');
  // A bare /search is the documents list, the same thing an Angular /search showed.
  expect(new URL(page.url()).searchParams.get('record')).toBe('documents');
  // The item stays lit while the reader is on the page, whichever record type they move to.
  await expect(search).toHaveAttribute('aria-current', 'page');
});
