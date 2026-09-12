/**
 * The parity gate: the built /search page against the design prototype, state by state.
 *
 * Both sides are driven from `states.ts` and resolve their controls through `selectors.ts`, and
 * every backend read is answered from `e2e/fixtures/unified-search`, so a difference in a
 * screenshot is a difference in what was built.
 *
 *   yarn test:parity
 *
 * Three guards, all read off the page rather than off a phase list. A test skips when the grid is
 * absent, when the `requires` selector its feature needs at load is absent, and when the first
 * control its step list needs is absent, which is how the states belonging to Phases 3-5 stay out
 * of the way without any of them costing a timeout. A state whose controls are all present is
 * compared in full; nothing about it is relaxed.
 */
import { expect, test } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import {
  checkMeasurements,
  freezeClock,
  OUT_OF_SCOPE_CSS,
  runSteps,
  settle,
  STILL_CSS,
} from './drive';
import { selectorFor } from './selectors';
import { measurementsFor, STATES, widthsFor } from './states';

/**
 * Matches the reference capture's viewport, so anything sized against the window lands the same on
 * both sides. Neither image is this tall: both are full-page shots of their whole document.
 */
const VIEWPORT_HEIGHT = 900;

for (const state of STATES) {
  for (const width of widthsFor(state)) {
    test(`${state.id} @ ${width}`, async ({ page }) => {
      await freezeClock(page);
      await routeDemiSearch(page);
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/search', { waitUntil: 'networkidle' });

      const grid = page.locator(selectorFor('root', 'app'));
      test.skip((await grid.count()) === 0, 'unified search page not built yet');

      if (state.requires) {
        const count = await page.locator(state.requires).count();
        test.skip(count === 0, `needs ${state.requires}, phase not built yet`);
      }

      await page.addStyleTag({ content: STILL_CSS });
      await page.addStyleTag({ content: OUT_OF_SCOPE_CSS });
      await grid.first().waitFor({ state: 'visible' });
      await settle(page);

      const firstControl = state.steps[0]?.control;
      if (firstControl) {
        const needed = selectorFor(firstControl, 'app');
        test.skip((await page.locator(needed).count()) === 0, `needs ${needed}, not built yet`);
      }

      await runSteps(page, state.steps, 'app');
      await settle(page);

      await expect(page).toHaveScreenshot(`${state.id}-${width}.png`, {
        // The whole page against the whole design: a height that differs fails before a pixel is
        // compared, because content below the fold is part of what was designed.
        fullPage: true,
        // 0.5% of the frame: enough for font hinting, not enough to hide a moved control.
        maxDiffPixelRatio: 0.005,
        animations: 'disabled',
        scale: 'css',
      });

      await checkMeasurements(page, measurementsFor(state, width), 'app');
    });
  }
}
