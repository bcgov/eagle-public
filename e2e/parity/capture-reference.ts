/**
 * Captures the reference screenshots from the design prototype.
 *
 * These PNGs are the parity gate's expected values: they come out of the designed artefact, not
 * out of the code under test, which is the whole point. Recapture only when the handoff changes.
 *
 *   yarn parity:reference
 *
 * Each state is its own test so a state that cannot be reached fails on its own and the rest
 * still capture.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '@playwright/test';

import { checkMeasurements, freezeClock, runSteps, settle, STILL_CSS } from './drive';
import { startPrototypeServer, type PrototypeServer } from './prototype-server';
import { selectorFor } from './selectors';
import { REFERENCE_DIR } from './paths';
import { measurementsFor, STATES, widthsFor } from './states';

/**
 * `support.js` sizes the artboard to the window (`html,body{height:100%}`,
 * `#dc-root,#dc-root>.sc-host{height:100%}`), which makes the body its own scroll container and
 * leaves `fullPage` photographing one fold of design over blank canvas. Only these four boxes are
 * released: scroll regions the design asks for, such as the table's `max-height: 560px`, are part
 * of what the app has to reproduce.
 */
const EXPAND_PAGE_CSS = `
  html, body, #dc-root, #dc-root > .sc-host {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
`;

let server: PrototypeServer;

test.beforeAll(async () => {
  server = await startPrototypeServer();
  mkdirSync(REFERENCE_DIR, { recursive: true });
});

test.afterAll(async () => {
  await server.close();
});

for (const state of STATES) {
  for (const width of widthsFor(state)) {
    test(`${state.id} @ ${width}`, async ({ page }) => {
      await freezeClock(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.url, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: STILL_CSS });

      // The grid arrives through `dc-import`, so the wrapper's load event is not enough.
      await page.locator(selectorFor('root', 'proto')).first().waitFor({ state: 'visible' });
      await settle(page);

      // Released before the steps run, not after, so the layout that is measured at the end of the
      // test is the same layout that was photographed.
      await page.addStyleTag({ content: EXPAND_PAGE_CSS });
      await settle(page);

      await runSteps(page, state.steps, 'proto');
      await settle(page);

      const png = await page.screenshot({ fullPage: true, scale: 'css' });

      // A clipped document writes a reference that cannot fail, so prove the release took before
      // anything reaches disk. Size out of the PNG's IHDR: width at byte 16, height at 20.
      const box = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
      }));
      expect(box.documentHeight, 'document is clipped above the body').toBe(box.bodyHeight);
      expect(png.readUInt32BE(20), 'captured height').toBe(box.documentHeight);
      expect(png.readUInt32BE(16), 'captured width').toBe(width);

      writeFileSync(join(REFERENCE_DIR, `${state.id}-${width}.png`), png);

      // Measuring here too means a reference that no longer meets the design spec fails at
      // capture time, rather than silently becoming the thing the app is held to.
      await checkMeasurements(page, measurementsFor(state, width), 'proto');
    });
  }
}
