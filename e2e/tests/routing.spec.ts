import { test, expect } from '../support/fixtures';
import { ready, latestCommentPeriod, unwrap, firstProjects } from '../support/helpers';

test('an unknown route falls back to the home page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await ready(page);

  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Environmental Assessments' })).toBeVisible();
});

test('/p/:projId redirects to the project-details tab', async ({ page, request }) => {
  const [project] = await firstProjects(request, 1);

  await page.goto(`/p/${project._id}`);
  await page.waitForURL(`**/p/${project._id}/project-details`);
  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/project-details`);
});

test('/p/:projId/cp/:cpId redirects to /details', async ({ page, request }) => {
  const cp = await latestCommentPeriod(request);

  await page.goto(`/p/${cp.project}/cp/${cp._id}`);
  await page.waitForURL(`**/p/${cp.project}/cp/${cp._id}/details`);
  expect(new URL(page.url()).pathname).toBe(`/p/${cp.project}/cp/${cp._id}/details`);
});

test('@data /pn/:projId/cp/:cpId redirects to /details', async ({ page, request }) => {
  const list = await request.get('/api/search?dataset=ProjectNotification&pageNum=0&pageSize=25&projectLegislation=default&sortBy=-_id&populate=true&fuzzy=false');
  const notifications = unwrap(await list.json()).searchResults;

  let pn: any, cp: any;
  for (const n of notifications) {
    const r = await request.get(`/api/commentperiod?project=${n._id}&sortBy=-dateStarted&fields=project|dateStarted`);
    const periods = await r.json();
    if (periods.length) { pn = n; cp = periods[0]; break; }
  }
  test.skip(!pn, 'no project notification with a comment period on this environment');

  await page.goto(`/pn/${pn._id}/cp/${cp._id}`);
  await page.waitForURL(`**/pn/${pn._id}/cp/${cp._id}/details`);
  expect(new URL(page.url()).pathname).toBe(`/pn/${pn._id}/cp/${cp._id}/details`);
});

test('/search/content redirects to /search while CONTENT_SEARCH is off', async ({ page, request }) => {
  const cfg = await (await request.get('/api/config')).json();
  const contentSearchEnabled = Boolean(cfg.CONTENT_SEARCH);

  await page.goto('/search/content');
  await ready(page);

  if (contentSearchEnabled) {
    expect(new URL(page.url()).pathname).toBe('/search/content');
  } else {
    // Recorded prod behaviour: the route guard rewrites a bookmarked link to document search.
    expect(new URL(page.url()).pathname).toBe('/search');
    await expect(page.getByRole('heading', { level: 1, name: 'Search All Documents' })).toBeVisible();
  }
});

test('the header navigates to every top-level destination', async ({ page }) => {
  await page.goto('/');
  await ready(page, 1000);

  await page.getByRole('link', { name: 'Map View' }).click();
  await page.waitForURL('**/projects');

  await page.goto('/');
  await ready(page, 1000);
  await page.getByRole('link', { name: 'Contact Us' }).click();
  await page.waitForURL('**/contact');
});
