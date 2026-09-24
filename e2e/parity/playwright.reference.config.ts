/**
 * Config for capturing the design prototype's reference screenshots.
 *
 * No web server: the capture starts its own static server over `design/handoffs/unified-search`.
 * Serial and single-worker so the PNGs are written in a known order and two states never fight
 * over the same viewport.
 */
import { defineConfig, devices } from '@playwright/test';

import { CAPTURE_USE } from './capture';

export default defineConfig({
  testDir: '.',
  testMatch: /capture-reference\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 10_000,
    // Same settings as the parity run; see `capture.ts`. The viewport is not the height of the
    // capture: `capture-reference.ts` releases the prototype's page-level scroll container first,
    // so the full-page shot is the whole design.
    ...CAPTURE_USE,
  },
});
