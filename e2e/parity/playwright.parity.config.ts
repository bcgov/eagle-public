/**
 * Config for the parity gate.
 *
 * Always runs against the local preview build, never a deployed environment: the comparison is
 * against prototype screenshots taken on this machine, and a remote host would differ in fonts and
 * in data. `snapshotPathTemplate` points the expected image at the captured references rather than
 * at Playwright's own generated folder.
 */
import { defineConfig, devices } from '@playwright/test';

import { CAPTURE_USE, SHOT_OPTIONS } from './capture';

const PORT = process.env['PARITY_PORT'] ?? '4173';
const PREVIEW_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch:
    /(unified-search\.parity|demi-search|list-row-hover|icon-link-underline|reference-check|stay-local)\.spec\.ts/,
  // Refuses a reference that is the wrong width, stops short of its page or changed after capture,
  // before any spec runs. Warns instead while the pixel comparison is parked.
  globalSetup: './reference-check.ts',
  // A missing or failing screenshot must never be written from the app over a designed reference.
  updateSnapshots: 'none',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000, toHaveScreenshot: SHOT_OPTIONS },
  // No cap. A cap of 10 under CI stopped the run after a third of the states, so a CI log showed
  // ten failures where there were thirty and the rest looked untested.
  maxFailures: 0,
  // The HTML report carries the diff images and the trace, so a CI failure leaves something to
  // look at. `never`: opening a browser would hang the run.
  reporter: [['list'], ['html', { outputFolder: '../parity-report', open: 'never' }]],
  // `{arg}` is the name passed to toHaveScreenshot, `{ext}` the extension.
  snapshotPathTemplate: '{testDir}/unified-search/reference/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: PREVIEW_URL,
    // A control the branch has not built yet must cost seconds, not the 90 s test budget.
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Same settings as the reference capture; see `capture.ts`.
    ...CAPTURE_USE,
    // State 17 reads back a "Link copied" label that only appears once navigator.clipboard
    // resolves. Headless Chromium rejects the write without these, so the label never flips.
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
  },
  webServer: {
    // Two levels up from this config: e2e/parity -> e2e -> repo root.
    command: `yarn --cwd ../.. preview --port ${PORT} --strictPort`,
    url: PREVIEW_URL,
    // Never adopt a server this run did not start: a stale preview serves a stale build, which the
    // gate would read as "nothing to compare" and report green.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
