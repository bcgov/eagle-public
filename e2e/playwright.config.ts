import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'https://projects.eao.gov.bc.ca';

// A local BASE_URL means the built app, so serve it here. Deployed targets are already up.
const LOCAL = BASE_URL.startsWith('http://localhost') || BASE_URL.startsWith('http://127.0.0.1');

// The test environment puts the whole site (but not /api) behind HTTP basic auth.
const { BASIC_AUTH_USER, BASIC_AUTH_PASS } = process.env;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Public prod site: be a polite client.
  workers: 2,
  retries: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: false,
    ...(BASIC_AUTH_USER && BASIC_AUTH_PASS
      ? { httpCredentials: { username: BASIC_AUTH_USER, password: BASIC_AUTH_PASS } }
      : {}),
  },
  webServer: LOCAL
    ? {
        command: 'yarn --cwd .. preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
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
