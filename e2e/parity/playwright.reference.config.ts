/**
 * Config for capturing the design prototype's reference screenshots.
 *
 * No web server: the capture starts its own static server over `design/handoffs/unified-search`.
 * Serial and single-worker so the PNGs are written in a known order and two states never fight
 * over the same viewport.
 */
import { defineConfig, devices } from '@playwright/test';

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
    // A scale of 1 keeps the PNG in CSS pixels, which is what the app side will produce too.
    deviceScaleFactor: 1,
    viewport: { width: 924, height: 900 },
    timezoneId: 'UTC',
    locale: 'en-CA',
    colorScheme: 'light',
  },
});
