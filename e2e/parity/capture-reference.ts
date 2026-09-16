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

      await runSteps(page, state.steps, 'proto');
      await settle(page);

      const png = await page.screenshot({ fullPage: true, scale: 'css' });
      writeFileSync(join(REFERENCE_DIR, `${state.id}-${width}.png`), png);
      expect(png.byteLength).toBeGreaterThan(0);

      // Measuring here too means a reference that no longer meets the design spec fails at
      // capture time, rather than silently becoming the thing the app is held to.
      await checkMeasurements(page, measurementsFor(state, width), 'proto');
    });
  }
}
