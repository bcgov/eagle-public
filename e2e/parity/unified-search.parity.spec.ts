/**
 * The parity gate: the built /search page against the design prototype, state by state.
 *
 * Both sides are driven from `states.ts` and resolve their controls through `selectors.ts`, and
 * every backend read is answered from `e2e/fixtures/unified-search`, so a difference in a
 * screenshot is a difference in what was built.
 *
 *   yarn test:parity
 *
 * Each state runs as two tests off the same driving code: the structural one, which reads
 * measurements off the page, and the pixel one, which compares the screenshot and is parked (see
 * `PIXEL_COMPARISON_PARKED` in `capture.ts`).
 *
 * Three guards, all read off the page rather than off a phase list. A test skips when the grid is
 * absent, when the `requires` selector its feature needs at load is absent, and when the first
 * control its step list needs is absent, which is how the states belonging to Phases 3-5 stay out
 * of the way without any of them costing a timeout. A state whose controls are all present is
 * compared in full; nothing about it is relaxed.
 */
import { expect, type Browser, type Page } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import {
  CAPTURE_USE,
  keepLocal,
  masksFor,
  PIXEL_COMPARISON_PARKED,
  SHOT_OPTIONS,
  STAYED_LOCAL,
  test,
  VIEWPORT,
} from './capture';
import {
  checkMeasurements,
  freezeClock,
  hidesScopeSegment,
  NOTIFICATIONS_COUNT_CSS,
  OUT_OF_SCOPE_CSS,
  runSteps,
  SCOPE_SEGMENT_CSS,
  settle,
  STILL_CSS,
} from './drive';
import { selectorFor } from './selectors';
import { measurementsFor, type ParityState, STATES, WIDE, WIDTHS, widthsFor } from './states';
import { computed, rootFontPx, SEARCH_STYLES, spacing } from './tokens';

/** Navigate, freeze everything that moves, replay the state's steps. Shared by both tests. */
async function driveState(page: Page, state: ParityState, width: number): Promise<void> {
  await freezeClock(page);
  await routeDemiSearch(page);
  await page.setViewportSize({ width, height: VIEWPORT.height });
  await page.goto('/search', { waitUntil: 'networkidle' });

  const grid = page.locator(selectorFor('root', 'app'));
  test.skip((await grid.count()) === 0, 'unified search page not built yet');

  if (state.requires) {
    const count = await page.locator(state.requires).count();
    test.skip(count === 0, `needs ${state.requires}, phase not built yet`);
  }

  await page.addStyleTag({ content: STILL_CSS });
  await page.addStyleTag({ content: OUT_OF_SCOPE_CSS });
  // Deviations the product owner accepted on 2026-09-12; each one is explained in `drive.ts`.
  await page.addStyleTag({ content: NOTIFICATIONS_COUNT_CSS });
  if (hidesScopeSegment(state)) await page.addStyleTag({ content: SCOPE_SEGMENT_CSS });
  await grid.first().waitFor({ state: 'visible' });
  await settle(page);

  const firstControl = state.steps[0]?.control;
  if (firstControl) {
    const needed = selectorFor(firstControl, 'app');
    test.skip((await page.locator(needed).count()) === 0, `needs ${needed}, not built yet`);
  }

  await runSteps(page, state.steps, 'app');
  await settle(page);

  // A state that walked somewhere else says so in words here, rather than as a pixel count nobody
  // can read back.
  if (state.expectText) {
    const carrier = page.locator(state.expectText.selector).first();
    await expect(carrier, state.expectText.selector).toHaveText(state.expectText.text[width]);
  }
}

for (const state of STATES) {
  for (const width of widthsFor(state)) {
    test(`${state.id} @ ${width}`, async ({ page }) => {
      await driveState(page, state, width);
      await checkMeasurements(page, measurementsFor(state, width), 'app');
    });

    test(`${state.id} @ ${width} pixels`, async ({ page }) => {
      test.fixme(
        PIXEL_COMPARISON_PARKED,
        'references predate the shared page band and wider layout; recapture with yarn parity:reference',
      );
      await driveState(page, state, width);

      await expect(page).toHaveScreenshot(`${state.id}-${width}.png`, {
        // The whole page against the whole design: a height that differs fails before a pixel is
        // compared, because content below the fold is part of what was designed. A state whose
        // subject cannot survive being scrolled compares the viewport instead, on both sides.
        fullPage: !state.viewportOnly,
        // 0.5% of the frame: enough for font hinting, not enough to hide a moved control.
        maxDiffPixelRatio: 0.005,
        // Animations, caret and scale come from the config (`SHOT_OPTIONS`).
        mask: masksFor(page, 'app'),
      });
    });
  }
}

/** The default view, and the one the value checks below read. */
const DEFAULT_STATE = STATES.find((state) => state.id === '01-documents-grid')!;
/** An overlay state, so the check covers a dialog as well as the page under it. */
const HELP_STATE = STATES.find((state) => state.id === '07-search-help-modal')!;

/** Drives `state` in a context of its own, so nothing carries over from an earlier capture. */
async function captureFresh(browser: Browser, state: ParityState, width: number): Promise<Buffer> {
  const context = await browser.newContext({
    ...CAPTURE_USE,
    baseURL: test.info().project.use.baseURL,
    permissions: test.info().project.use.permissions,
  });
  const stopped = await keepLocal(context);
  try {
    const page = await context.newPage();
    await driveState(page, state, width);
    return await page.screenshot({
      ...SHOT_OPTIONS,
      fullPage: !state.viewportOnly,
      mask: masksFor(page, 'app'),
    });
  } finally {
    await context.close();
    expect(stopped, STAYED_LOCAL).toEqual([]);
  }
}

// A difference here is something that moves between runs: freeze it, or add it to `MASKS`.
for (const state of [DEFAULT_STATE, HELP_STATE]) {
  for (const width of WIDTHS) {
    test(`${state.id} @ ${width} captures the same twice`, async ({ browser }) => {
      const first = await captureFresh(browser, state, width);
      const second = await captureFresh(browser, state, width);
      expect(second.equals(first), 'second capture differs from the first').toBe(true);
    });
  }
}

/*
 * Value checks. Separate tests from the pixel ones, so they run and report while the screenshot
 * is parked or failing, and a wrong colour fails as two values rather than as an image.
 */

for (const style of SEARCH_STYLES) {
  const expected = style.token ?? style.value;
  test(`${style.element} ${style.property} is ${expected}`, async ({ page }) => {
    await driveState(page, DEFAULT_STATE, WIDE);
    await expect(
      page.locator(selectorFor(style.control, 'app')).first(),
      `${style.element} ${style.property} (${expected})`,
    ).toHaveCSS(style.property, computed(style.value, await rootFontPx(page)));
  });
}

/** Sub-pixel layout and rounding; a moved control is off by far more. */
const TOLERANCE_PX = 1;

function expectNear(actual: number, expected: number, what: string): void {
  expect(
    actual,
    `${what}: ${actual}px, expected ${expected}px ±${TOLERANCE_PX}`,
  ).toBeGreaterThanOrEqual(expected - TOLERANCE_PX);
  expect(
    actual,
    `${what}: ${actual}px, expected ${expected}px ±${TOLERANCE_PX}`,
  ).toBeLessThanOrEqual(expected + TOLERANCE_PX);
}

async function box(page: Page, selector: string, nth = 0) {
  const found = await page.locator(selector).nth(nth).boundingBox();
  expect(found, `${selector} is not laid out`).not.toBeNull();
  return found!;
}

const GRID = selectorFor('root', 'app');
const SEARCH = selectorFor('searchInput', 'app');
const HELP = selectorFor('searchHelpLink', 'app');
const PILLS = selectorFor('recordPills', 'app');

for (const width of WIDTHS) {
  test(`search box and record pills start on the grid's left edge @ ${width}`, async ({ page }) => {
    await driveState(page, DEFAULT_STATE, width);
    const grid = await box(page, GRID);
    expectNear((await box(page, SEARCH)).x, grid.x, 'search box left');
    expectNear((await box(page, PILLS)).x, grid.x, 'first record pill left');
  });

  test(`search help link ends on the grid's right edge @ ${width}`, async ({ page }) => {
    await driveState(page, DEFAULT_STATE, width);
    const grid = await box(page, GRID);
    const help = await box(page, HELP);
    expectNear(help.x + help.width, grid.x + grid.width, 'search help right');
  });

  test(`record pills sit --layout-padding-xsmall apart @ ${width}`, async ({ page }) => {
    await driveState(page, DEFAULT_STATE, width);
    const first = await box(page, PILLS, 0);
    const second = await box(page, PILLS, 1);
    expectNear(second.y, first.y, 'second pill top');
    const gap = spacing('layoutPaddingXsmall', await rootFontPx(page));
    expectNear(second.x - (first.x + first.width), gap, 'pill gap');
  });

  test(`toolbar status is inset by --layout-padding-medium @ ${width}`, async ({ page }) => {
    await driveState(page, DEFAULT_STATE, width);
    const toolbar = await box(page, selectorFor('toolbar', 'app'));
    const status = await box(page, selectorFor('toolbarStatus', 'app'));
    const inset = spacing('layoutPaddingMedium', await rootFontPx(page));
    expectNear(status.x - toolbar.x, inset, 'status inset');
  });

  test(`search controls keep their roles and names @ ${width}`, async ({ page }) => {
    await driveState(page, DEFAULT_STATE, width);
    await expect(page.locator('.unified-search__query')).toMatchAriaSnapshot(`
      - searchbox "Search projects, documents, updates and comment periods"
      - link "Search help"
    `);
    await expect(page.locator('[data-tour="types"]')).toMatchAriaSnapshot(`
      - group "Record type":
        - /children: equal
        - button "Projects 12"
        - button "Documents 18" [pressed]
        - button "Activities & updates 10"
        - button "Project notifications"
        - button "Comment periods"
    `);
    // The scope segment and the notifications count are hidden by this harness (`drive.ts`).
    await expect(page.locator(selectorFor('toolbar', 'app'))).toMatchAriaSnapshot(`
      - status: 1–18 of 18 documents
      - button "More filters"
      - button "Columns"
      - button "Copy link to this view"
    `);
  });
}
