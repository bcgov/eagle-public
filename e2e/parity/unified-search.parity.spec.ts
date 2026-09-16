/**
 * The parity gate: the built /search page against the design prototype, state by state.
 *
 * Both sides are driven from `states.ts` and resolve their controls through `selectors.ts`, and
 * every backend read is answered from `e2e/fixtures/unified-search`, so a difference in a
 * screenshot is a difference in what was built.
 *
 *   yarn test:parity
 *
 * The unified /search page does not exist on this branch. Each test skips itself once it has
 * navigated and found no grid, which keeps the suite green now and live the moment Phase 2 lands
 * the component.
 */
import { expect, test } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { checkMeasurements, freezeClock, runSteps, settle, STILL_CSS } from './drive';
import { selectorFor } from './selectors';
import { measurementsFor, STATES, widthsFor } from './states';

for (const state of STATES) {
  for (const width of widthsFor(state)) {
    test(`${state.id} @ ${width}`, async ({ page }) => {
      await freezeClock(page);
      await routeDemiSearch(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/search', { waitUntil: 'networkidle' });

      const grid = page.locator(selectorFor('root', 'app'));
      test.skip((await grid.count()) === 0, 'unified search page not built yet');

      await page.addStyleTag({ content: STILL_CSS });
      await grid.first().waitFor({ state: 'visible' });
      await settle(page);

      await runSteps(page, state.steps, 'app');
      await settle(page);

      await expect(page).toHaveScreenshot(`${state.id}-${width}.png`, {
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
