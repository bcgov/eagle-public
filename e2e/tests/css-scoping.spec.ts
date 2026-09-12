import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../support/fixtures';
import { latestCommentPeriod, projectByKeyword, ready } from '../support/helpers';

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
  const cp = await latestCommentPeriod(request);

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  // The page renders its own `.project > main.project-info`; the project shell styles `.project-page`
  // only, so nothing here may reach these.
  expect(await styleOf(page, 'main.project-info', 'display')).toBe('block');
  const width = await page
    .locator('main.project-info')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(1000);
  // The hero copy is not the shared hero-banner component's.
  expect(await styleOf(page, '.hero-banner__content p', 'max-width')).toBe('none');
});

test('the search grid states its own control heights and label layout', async ({ page }) => {
  await page.goto('/search');
  await ready(page);

  // `epic/styles.css` sets a form-control height on bare inputs, which a `min-height` alone loses
  // to, so both the page's keyword field and the grid's controls state a height of their own.
  expect(await styleOf(page, '.unified-search__input', 'height')).toBe('48px');
  expect(await styleOf(page, '.display-grid__control', 'height')).toBe('30px');

  // The Bootstrap reboot makes `label` inline-block, which shrink-wraps the control inside it.
  await page.locator('[data-tour="columns"]').click();
  expect(await styleOf(page, '.display-grid__menu label', 'display')).toBe('block');
});

/** Every selector the stylesheet declares, at-rules unwrapped and comma lists split. */
function selectorsOf(file: string): string[] {
  const css = fs
    .readFileSync(path.join(__dirname, '..', '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((selector) => !selector.startsWith('@'))
    .flatMap((selector) => selector.split(',').map((part) => part.trim()));
  expect(selectors.length, `${file} declares no rules`).toBeGreaterThan(0);
  return selectors;
}

/**
 * Angular scoped these files per component. They ship as plain global CSS now, so a bare `body`,
 * `a`, `label` or `input` rule in either would beat the host shell's own rule for the whole site.
 */
test('the unified search page stylesheet stays inside .unified-search', () => {
  expect(
    selectorsOf('src/app/pages/search/unified-search.css').filter(
      (selector) => !selector.startsWith('.unified-search'),
    ),
  ).toEqual([]);
});

test('the display grid stylesheet stays inside .display-grid', () => {
  expect(
    selectorsOf('src/app/components/display-grid/display-grid.css').filter(
      (selector) => !selector.startsWith('.display-grid'),
    ),
  ).toEqual([]);
});

test('the project panel map is not laid out like the full-page map', async ({ page, request }) => {
  const project = await projectByKeyword(request, 'Site C');

  await page.goto(`/p/${project._id}/overview`);
  await ready(page);
  expect(await styleOf(page, '.map-container', 'position')).toBe('relative');
  expect(await styleOf(page, '.map-container', 'height')).toBe('192px');
});

test('the notification Engagement panel is not padded like a detail field block', async ({
  page,
}) => {
  await page.goto('/project-notifications');
  await ready(page);
  expect(await styleOf(page, '.pn-info-block.tab-section', 'padding-left')).toBe('0px');
});
