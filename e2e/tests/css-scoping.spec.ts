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

test('the home update reader keeps full-width, left-aligned body copy', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.locator('.home-update[href]').first().click();
  // Angular's `main p { max-width: 780px; margin: 0 auto }` belonged to the old About block, never
  // to the API HTML the reader renders.
  expect(await styleOf(page, '.home-reader .update-detail__content p', 'max-width')).toBe('none');
});

test('the home page stylesheet stays inside .home', () => {
  expect(
    selectorsOf('src/app/pages/home/home.css').filter((selector) => !selector.startsWith('.home')),
  ).toEqual([]);
});

test('the comment period banner spans the page on the masthead edge', async ({ page, request }) => {
  const cp = await latestCommentPeriod(request);

  await page.goto(`/p/${cp.project}/cp/${cp._id}/details`);
  await ready(page);

  // The project shell styles `.project-page` only, so none of it may reach the period's banner.
  expect(await styleOf(page, '.comment-banner__body', 'display')).toBe('block');
  const width = await page
    .locator('.comment-banner')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(1000);
  // The banner's content starts on the shared masthead's left edge, under its title.
  const titleLeft = await page
    .locator('.comment-banner h1')
    .evaluate((el) => el.getBoundingClientRect().left);
  const bodyLeft = await page
    .locator('.comment-banner__body')
    .evaluate((el) => el.getBoundingClientRect().left);
  expect(bodyLeft).toBeCloseTo(titleLeft, 1);
});

test('the search grid states its own control heights and label layout', async ({ page }) => {
  await page.goto('/search');
  await ready(page);

  // `epic/styles.css` sets a form-control height on bare inputs, which a `min-height` alone loses
  // to, so both the page's keyword field and the grid's controls state a height of their own.
  expect(await styleOf(page, '.unified-search__input', 'height')).toBe('48px');
  expect(await styleOf(page, '.display-grid__control', 'height')).toBe('30px');

  // Option rows (`.display-grid__option`, checkbox + text `label`s) are flex rows by design;
  // other grid labels still get the reboot fix's `label { display: block }`.
  await page.locator('[data-tour="columns"]').click();
  expect(await styleOf(page, '.display-grid__menu label', 'display')).toBe('flex');
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

test('the help dialog and the tour stay inside .display-grid too', () => {
  const selectors = [
    ...selectorsOf('src/app/components/display-grid/search-help-dialog.css'),
    ...selectorsOf('src/app/components/display-grid/guided-tour.css'),
  ];
  expect(selectors.filter((selector) => !selector.startsWith('.display-grid'))).toEqual([]);
});

test('the project panel map is not laid out like the full-page map', async ({ page, request }) => {
  const project = await projectByKeyword(request, 'Site C');

  await page.goto(`/p/${project._id}/overview`);
  await ready(page);
  expect(await styleOf(page, '.map-container', 'position')).toBe('relative');
  expect(await styleOf(page, '.map-container', 'height')).toBe('192px');
});
