import { test, expect } from '../support/fixtures';
import { ready, latestCommentPeriod, searchFixture, firstProjects } from '../support/helpers';

test('an unknown route falls back to the home page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await ready(page);

  expect(new URL(page.url()).pathname).toBe('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Environmental Assessments' }),
  ).toBeVisible();
});

test('/p/:projId redirects to the overview tab', async ({ page, request }) => {
  const [project] = await firstProjects(request, 1);

  await page.goto(`/p/${project._id}`);
  await page.waitForURL(`**/p/${project._id}/overview`);
  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/overview`);
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
    'dataset=ProjectNotification&pageNum=0&pageSize=25&projectLegislation=default&sortBy=-_id&populate=true&fuzzy=false',
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

// The Angular-era list pages. Each one keeps working as a bookmark by landing on unified search
// with its record type and its keyword intact.
const LEGACY_SEARCH_URLS = [
  { from: '/projects-list?keywords=coal&currentPage=2', record: 'projects' },
  { from: '/news?keywords=coal', record: 'activities' },
  { from: '/project-notifications?keywords=coal', record: 'notifications' },
  { from: '/search/content?keywords=coal', record: 'documents' },
];

for (const { from, record } of LEGACY_SEARCH_URLS) {
  test(`${from} lands on unified search as ${record}`, async ({ page }) => {
    await page.goto(from);
    await page.waitForURL('**/search?*');

    const url = new URL(page.url());
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('record')).toBe(record);
    expect(url.searchParams.get('keywords')).toBe('coal');
  });
}

test('an old hash-router address re-enters the path routes', async ({ page }) => {
  await page.goto('/#/project-notifications?keywords=coal');
  await page.waitForURL('**/search?*');

  const url = new URL(page.url());
  expect(url.pathname).toBe('/search');
  expect(url.searchParams.get('record')).toBe('notifications');
  expect(url.searchParams.get('keywords')).toBe('coal');
});

test('the header navigates to every top-level destination', async ({ page }) => {
  await page.goto('/');
  await ready(page, 1000);

  await page.getByRole('banner').getByRole('link', { name: 'Map Explorer' }).click();
  await page.waitForURL('**/projects');

  await page.goto('/');
  await ready(page, 1000);
  // The footer carries a gov.bc.ca "Contact us" link too, so scope the lookup to the header.
  await page.getByRole('banner').getByRole('link', { name: 'Contact Us' }).click();
  await page.waitForURL('**/contact');
});
