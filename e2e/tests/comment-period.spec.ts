import { test, expect } from '@playwright/test';
import { ready, recordApiCalls, checkBaseline, latestCommentPeriod, isOpen, unwrap } from '../support/helpers';

test('comment period details page renders the period status and dates', async ({ page, request }) => {
  const cp = await latestCommentPeriod(request);
  const calls = recordApiCalls(page);

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  await expect(page.locator('h1')).toHaveCount(1);
  const status = page.getByRole('heading', { level: 2 }).first();
  await expect(status).toHaveText(/Public Comment Period is/);
  await expect(status).toHaveText(isOpen(cp) ? /Open|Now Open/i : /Closed|Now Closed/i);
  await expect(page.getByRole('button', { name: /BACK TO PROJECT DETAILS/i })).toBeVisible();

  checkBaseline('comment-period-details', calls);
});

test('a closed comment period offers no way to submit a comment', async ({ page, request }) => {
  const cp = await latestCommentPeriod(request);
  test.skip(isOpen(cp), 'this environment has an open comment period; see the open-period test');

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  await expect(page.getByRole('heading', { level: 2, name: /Public Comment Period is Now Closed/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add (a )?Comment|Submit/i })).toHaveCount(0);
  await expect(page.locator('app-add-comment, form.add-comment')).toHaveCount(0);
});

test('an open comment period exposes the add-comment entry point but is never submitted', async ({ page, request }) => {
  const cp = await latestCommentPeriod(request);
  test.skip(!isOpen(cp), 'no open comment period on this environment');

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  await expect(page.getByRole('button', { name: /Add (a )?Comment/i }).first()).toBeVisible();
  // Deliberately not clicked through to submit: this is a live public inbox.
});

test('the comment period API is reachable and carries the project', async ({ request }) => {
  const cp = await latestCommentPeriod(request);
  const res = await request.get(`/api/commentperiod/${cp._id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  const record = Array.isArray(body) ? body[0] : body;
  expect(record._id).toBe(cp._id);
});

test('@data a project notification comment period renders through /pn', async ({ page, request }) => {
  const list = await request.get('/api/search?dataset=ProjectNotification&pageNum=0&pageSize=25&projectLegislation=default&sortBy=-_id&populate=true&fuzzy=false');
  expect(list.status()).toBe(200);
  const notifications = unwrap(await list.json()).searchResults;

  let pn: any, cp: any;
  for (const n of notifications) {
    const r = await request.get(`/api/commentperiod?project=${n._id}&sortBy=-dateStarted&fields=project|dateStarted|dateCompleted`);
    const periods = await r.json();
    if (periods.length) { pn = n; cp = periods[0]; break; }
  }
  test.skip(!pn, 'no project notification with a comment period on this environment');

  await page.goto(`/pn/${pn._id}/cp/${cp._id}/details`);
  await ready(page);

  expect(new URL(page.url()).pathname).toBe(`/pn/${pn._id}/cp/${cp._id}/details`);
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(/Public Comment Period is/);
});
