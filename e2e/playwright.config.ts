import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://projects.eao.gov.bc.ca';

// A loopback BASE_URL with an explicit port is a preview server this config starts, so two checkouts
// can run at once. Any other target (deployed, or the dev server on 4200) is already up: leave it.
const PREVIEW_PORT = BASE_URL.match(/^http:\/\/(?:localhost|127\.0\.0\.1):(\d+)\/?$/)?.[1];
const OWNS_SERVER = PREVIEW_PORT !== undefined && PREVIEW_PORT !== '4200';

const { BASIC_AUTH_USER, BASIC_AUTH_PASS } = process.env;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Public prod site: be a polite client.
  workers: 2,
  retries: process.env['CI'] ? 2 : 1,
  // On CI, an unreachable test environment fails every test; stop early instead of timing out on
  // each one.
  maxFailures: process.env['CI'] ? 10 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 60_000,
    // Also the `request` fixture's ceiling; the test API answers a GitHub runner in 20-30 s.
    actionTimeout: 60_000,
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: false,
    ...(BASIC_AUTH_USER && BASIC_AUTH_PASS
      ? { httpCredentials: { username: BASIC_AUTH_USER, password: BASIC_AUTH_PASS } }
      : {}),
  },
  webServer: OWNS_SERVER
    ? {
        command: `yarn --cwd .. preview --port ${PREVIEW_PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // MapLibre needs WebGL; headless chromium has no GPU, so it software-renders.
        launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
});
