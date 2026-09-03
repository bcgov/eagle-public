import { test, expect } from '../support/fixtures';
import { ready } from '../support/helpers';

/**
 * Angular scoped every component stylesheet with a `[_ngcontent]` attribute on its last compound
 * selector, so a rule reached only that component's own markup and carried one extra unit of
 * specificity. The React port ships those files as plain global CSS, which drops both effects, and
 * each case below is a rule that visibly went wrong because of it. Every value is asserted, not
 * compared to a snapshot, so the file means the same thing run against the deployed site.
 */

async function styleOf(
  page: import('@playwright/test').Page,
  selector: string,
  property: string,
): Promise<string> {
  // These pages fill in after several request waves; wait for the element rather than reading a
  // style off a page that has not finished rendering.
  await page.locator(selector).first().waitFor({ state: 'attached', timeout: 60_000 });
  const value = await page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).getPropertyValue(prop) : null;
    },
    [selector, property],
  );
  expect(value, `${selector} not on the page`).not.toBeNull();
  return value!;
}

test('home activity cards keep full-width, left-aligned body copy', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // `main p { max-width: 780px; margin: 0 auto }` belongs to the About block, not to the API HTML
  // the cards render.
  expect(await styleOf(page, '.home-news-feed .activity-card p', 'max-width')).toBe('none');
  expect(await styleOf(page, '.bg-faded p', 'max-width')).toBe('780px');
});

test('news activity cells keep the card padding, and the date cell the table padding', async ({
  page,
}) => {
  await page.goto('/news');
  await ready(page);
  expect(await styleOf(page, 'td.activity-card', 'padding-top')).toBe('20px');
  expect(await styleOf(page, 'td.activity-card__date', 'padding-top')).toBe('12px');
  expect(await styleOf(page, 'td.activity-card__date', 'color')).toBe('rgb(73, 73, 73)');
});

test('the comment period hero spans the page', async ({ page, request }) => {
  const list = await (
    await request.get(
      '/api/commentperiod?sortBy=-dateStarted&fields=project|dateStarted|dateCompleted',
    )
  ).json();
  const cp = list.find((c: any) => c.project && c.dateStarted && c.dateCompleted);
  expect(cp, 'no comment period on this environment').toBeTruthy();

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  // The page renders its own `.project > main.project-info`; the project shell's grid must not
  // squeeze it into the sidebar column.
  expect(await styleOf(page, 'main.project-info', 'display')).toBe('block');
  const width = await page
    .locator('main.project-info')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(1000);
  // The hero copy is not the shared hero-banner component's.
  expect(await styleOf(page, '.hero-banner__content p', 'max-width')).toBe('none');
});

test('the search keyword clear button stays inside the input', async ({ page }) => {
  await page.goto('/search?keywords=water');
  await ready(page);
  expect(await styleOf(page, '.search-clear-btn', 'position')).toBe('absolute');
});

test('the project detail sidebar map is not laid out like the full-page map', async ({
  page,
  request,
}) => {
  const body = await (
    await request.get(
      '/api/search?dataset=Project&pageNum=0&pageSize=1&keywords=Site%20C&projectLegislation=default&sortBy=-score&populate=true&fuzzy=false',
    )
  ).json();
  const project = (Array.isArray(body) ? body[0] : body).searchResults[0];

  await page.goto(`/p/${project._id}/project-details`);
  await ready(page);
  expect(await styleOf(page, '.map-container', 'position')).toBe('relative');
  expect(await styleOf(page, '.map-container', 'height')).toBe('272px');
});

test('project detail child headings are not the details tab heading colour', async ({
  page,
  request,
}) => {
  const body = await (
    await request.get(
      '/api/search?dataset=Project&pageNum=0&pageSize=1&keywords=Site%20C&projectLegislation=default&sortBy=-score&populate=true&fuzzy=false',
    )
  ).json();
  const project = (Array.isArray(body) ? body[0] : body).searchResults[0];

  await page.goto(`/p/${project._id}/project-details`);
  await ready(page);
  expect(await styleOf(page, '.tab-content h3', 'color')).toBe('rgb(73, 73, 73)');
});

test('the notification Engagement panel is not padded like a detail field block', async ({
  page,
}) => {
  await page.goto('/project-notifications');
  await ready(page);
  expect(await styleOf(page, '.pn-info-block.tab-section', 'padding-left')).toBe('0px');
});
