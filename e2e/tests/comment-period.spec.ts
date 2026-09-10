import { test, expect } from '../support/fixtures';
import {
  ready,
  recordApiCalls,
  checkBaseline,
  latestCommentPeriod,
  isOpen,
  searchFixture,
  commentPeriodsOf,
} from '../support/helpers';

/**
 * The three headings `comments.tsx` renders, one per `commentPeriodStatus`. Anchored, so the
 * heading for one status cannot satisfy an assertion meant for another.
 */
const PERIOD_HEADINGS = {
  Open: /^Public Comment Period is Now Open$/i,
  Closed: /^Public Comment Period is Now Closed$/i,
  Upcoming: /^Public Comment Period is Upcoming$/i,
};

/** The heading the period's own dates call for, on the same window `isOpen` reads. */
function expectedHeading(cp: any): RegExp {
  if (isOpen(cp)) return PERIOD_HEADINGS.Open;
  return Date.now() < Date.parse(cp.dateStarted)
    ? PERIOD_HEADINGS.Upcoming
    : PERIOD_HEADINGS.Closed;
}

test('comment period details page renders the period status and dates', async ({
  page,
  request,
}) => {
  const cp = await latestCommentPeriod(request);
  const calls = recordApiCalls(page);

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  await expect(page.locator('h1')).toHaveCount(1);
  const status = page.getByRole('heading', { level: 2 }).first();
  await expect(status).toHaveText(expectedHeading(cp));
  await expect(page.getByRole('button', { name: /BACK TO PROJECT DETAILS/i })).toBeVisible();

  checkBaseline('comment-period-details', calls);
});

test('a comment period offers no way to submit a comment, open or closed', async ({
  page,
  request,
}) => {
  const cp = await latestCommentPeriod(request);

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: expectedHeading(cp),
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Add (a )?Comment|Submit/i })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the comment period API is reachable and carries the project', async ({ request }) => {
  const cp = await latestCommentPeriod(request);
  // `and[_id]`, the filter form `api.getPeriod` uses: a bare `_id` is not read as a filter.
  const [record] = await searchFixture(
    request,
    `dataset=CommentPeriod&pageNum=0&pageSize=1&and[_id]=${cp._id}`,
  );
  expect(record?._id).toBe(cp._id);
  expect(record.project).toBeTruthy();
});

test('@data a project notification comment period renders through /pn', async ({
  page,
  request,
}) => {
  const notifications = await searchFixture(
    request,
    'dataset=ProjectNotification&pageNum=0&pageSize=25&projectLegislation=default&sortBy=-_id&populate=true&fuzzy=false',
  );

  let pn: any, cp: any;
  for (const n of notifications) {
    const periods = await commentPeriodsOf(request, n._id, 1);
    if (periods.length) {
      pn = n;
      cp = periods[0];
      break;
    }
  }
  test.skip(!pn, 'no project notification with a comment period on this environment');

  await page.goto(`/pn/${pn._id}/cp/${cp._id}/details`);
  await ready(page);

  expect(new URL(page.url()).pathname).toBe(`/pn/${pn._id}/cp/${cp._id}/details`);
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(expectedHeading(cp));
});
