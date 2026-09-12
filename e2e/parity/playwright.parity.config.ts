/**
 * Config for the parity gate.
 *
 * Always runs against the local preview build, never a deployed environment: the comparison is
 * against prototype screenshots taken on this machine, and a remote host would differ in fonts and
 * in data. `snapshotPathTemplate` points the expected image at the captured references rather than
 * at Playwright's own generated folder.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env['PARITY_PORT'] ?? '4173';
const PREVIEW_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: /(unified-search\.parity|demi-search)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // A whole run of states blocked on the same missing control is one answer, not thirty.
  maxFailures: process.env['CI'] ? 10 : 0,
  reporter: [['list']],
  // `{arg}` is the name passed to toHaveScreenshot, `{ext}` the extension.
  snapshotPathTemplate: '{testDir}/unified-search/reference/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: PREVIEW_URL,
    // A control the branch has not built yet must cost seconds, not the 90 s test budget.
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Must match the reference capture, or every pixel is off by the scale factor.
    deviceScaleFactor: 1,
    viewport: { width: 924, height: 900 },
    timezoneId: 'UTC',
    locale: 'en-CA',
    colorScheme: 'light',
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
