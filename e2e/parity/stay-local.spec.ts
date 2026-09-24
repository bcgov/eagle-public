/**
 * The predicate behind the network guard in `capture.ts`. Plain Node: no browser, no server.
 */
import { expect, test } from '@playwright/test';

import { leavesMachine } from './capture';

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
