/**
 * Config for the parity gate.
 *
 * Always runs against the local preview build, never a deployed environment: the comparison is
 * against prototype screenshots taken on this machine, and a remote host would differ in fonts and
 * in data. `snapshotPathTemplate` points the expected image at the captured references rather than
 * at Playwright's own generated folder.
 */
import { defineConfig, devices } from '@playwright/test';

const PREVIEW_URL = 'http://localhost:4173';

export default defineConfig({
  testDir: '.',
  testMatch: /(unified-search\.parity|demi-search)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  // `{arg}` is the name passed to toHaveScreenshot, `{ext}` the extension.
  snapshotPathTemplate: '{testDir}/unified-search/reference/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: PREVIEW_URL,
    // Must match the reference capture, or every pixel is off by the scale factor.
    deviceScaleFactor: 1,
    viewport: { width: 924, height: 900 },
    timezoneId: 'UTC',
    locale: 'en-CA',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Two levels up from this config: e2e/parity -> e2e -> repo root.
    command: 'yarn --cwd ../.. preview --port 4173 --strictPort',
    url: PREVIEW_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
