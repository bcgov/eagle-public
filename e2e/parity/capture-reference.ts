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

import { test, expect, type Page } from '@playwright/test';

import {
  checkMeasurements,
  freezeClock,
  hidesScopeSegment,
  runSteps,
  SCOPE_SEGMENT_CSS,
  settle,
  STILL_CSS,
} from './drive';
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

/** Matches the viewport the parity spec compares against. */
const VIEWPORT_HEIGHT = 900;

/**
 * Accepted deviation, 2026-09-12: the prototype's `epic/styles.css` still `@import`s the
 * pre-redesign `app/footer.css` over the `site-footer.css` both sides share, which pads the
 * footer by 18px the app never draws. Blocked, not overridden, so the box is the app's own.
 */
async function blockLegacyFooterStyles(page: Page): Promise<void> {
  await page.route('**/epic/app/footer.css', (route) => route.abort());
}

/**
 * Adds the fourth record pill, Project notifications, which the design was drawn without.
 * Accepted deviation, 2026-09-12; the app's matching count badge is hidden (`drive.ts`).
 *
 * Run after the steps: every click re-renders the prototype's tab list from its own data.
 */
async function addNotificationsPill(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('[data-tour="types"] button'));
    if (pills.length !== 3) throw new Error(`prototype drew ${pills.length} record pills, not 3`);
    const clone = pills[2]!.cloneNode(true) as HTMLElement;
    // Styling is inline and per-pill, so an unpressed sibling is the only source of the off state.
    const off = pills.find((pill) => pill.getAttribute('aria-pressed') !== 'true') ?? pills[2]!;
    clone.setAttribute('aria-pressed', 'false');
    clone.setAttribute('style', off.getAttribute('style') ?? '');
    // The prototype draws a pill as label span then count span; the count goes, the label is set.
    const [label, count] = Array.from(clone.querySelectorAll('span'));
    if (!label) throw new Error('record pill has no label');
    label.textContent = 'Project notifications';
    count?.remove();
    pills[2]!.after(clone);
  });
}

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
      await blockLegacyFooterStyles(page);
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto(server.url, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: STILL_CSS });
      if (hidesScopeSegment(state)) await page.addStyleTag({ content: SCOPE_SEGMENT_CSS });

      // The grid arrives through `dc-import`, so the wrapper's load event is not enough.
      await page.locator(selectorFor('root', 'proto')).first().waitFor({ state: 'visible' });
      await settle(page);

      // Released before the steps run, not after, so the layout that is measured at the end of the
      // test is the same layout that was photographed.
      await page.addStyleTag({ content: EXPAND_PAGE_CSS });
      await settle(page);

      await runSteps(page, state.steps, 'proto');
      await addNotificationsPill(page);
      await settle(page);

      const fullPage = !state.viewportOnly;
      const png = await page.screenshot({ fullPage, scale: 'css' });

      // A clipped document writes a reference that cannot fail, so prove the release took before
      // anything reaches disk. Size out of the PNG's IHDR: width at byte 16, height at 20.
      if (fullPage) {
        const box = await page.evaluate(() => ({
          documentHeight: document.documentElement.scrollHeight,
          bodyHeight: document.body.scrollHeight,
        }));
        expect(box.documentHeight, 'document is clipped above the body').toBe(box.bodyHeight);
        expect(png.readUInt32BE(20), 'captured height').toBe(box.documentHeight);
      } else {
        expect(png.readUInt32BE(20), 'captured height').toBe(VIEWPORT_HEIGHT);
      }
      expect(png.readUInt32BE(16), 'captured width').toBe(width);

      writeFileSync(join(REFERENCE_DIR, `${state.id}-${width}.png`), png);

      // Measuring here too means a reference that no longer meets the design spec fails at
      // capture time, rather than silently becoming the thing the app is held to.
      await checkMeasurements(page, measurementsFor(state, width), 'proto');
    });
  }
}
