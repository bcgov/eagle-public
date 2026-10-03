/**
 * The network guard in `capture.ts`: the predicate in plain Node, then `keepLocal` and the guarded
 * `test` in a browser on `about:blank`, so no server is needed.
 */
import { expect, test } from '@playwright/test';

import { keepLocal, leavesMachine, test as guarded } from './capture';

const LEAVES = [
  'https://eagle-test.apps.silver.devops.gov.bc.ca/api/config',
  'http://example.com/',
  'wss://example.com/socket',
  'ws://10.0.0.5:8080/',
];

const STAYS = [
  'http://localhost:4173/search',
  'http://127.0.0.1:53211/index.html',
  'http://[::1]:4173/',
  'http://preview.localhost:4173/',
  'http://0.0.0.0:4173/',
  'ws://localhost:4173/hmr',
  'data:image/png;base64,iVBORw0KGgo=',
  'blob:http://localhost:4173/7d2f6a1c',
];

for (const url of LEAVES) {
  test(`blocks ${url}`, () => {
    expect(leavesMachine(new URL(url))).toBe(true);
  });
}

for (const url of STAYS) {
  test(`allows ${url}`, () => {
    expect(leavesMachine(new URL(url))).toBe(false);
  });
}

const FETCH_URL = 'https://example.com/api/config';
const SOCKET_URL = 'wss://example.com/socket';

test('keepLocal aborts an external fetch and web socket through the context', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const stopped = await keepLocal(context);
  const page = await context.newPage();
  const failure = page
    .waitForEvent('requestfailed')
    .then((request) => request.failure()?.errorText);

  const fetched = await page.evaluate(
    async ([fetchUrl, socketUrl]) => {
      const result = await fetch(fetchUrl!).then(
        () => 'answered',
        () => 'refused',
      );
      await new Promise((resolve) => {
        new WebSocket(socketUrl!).onclose = resolve;
      });
      return result;
    },
    [FETCH_URL, SOCKET_URL],
  );

  expect(fetched).toBe('refused');
  expect(await failure).toMatch(/^net::ERR_BLOCKED_BY_CLIENT/);
  expect(stopped).toEqual([FETCH_URL, SOCKET_URL]);
  await context.close();
});

// The body swallows the refusal, so the only thing left to fail is the fixture's teardown check.
guarded.fail('the guarded test fails at teardown after an external request', async ({ page }) => {
  await page.evaluate((url) => fetch(url).catch(() => undefined), FETCH_URL);
});
