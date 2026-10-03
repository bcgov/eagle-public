/**
 * What makes two captures of the same page come out the same, in one place. Both configs spread
 * `CAPTURE_USE`, and both the reference capture and the parity spec take their screenshot through
 * `SHOT_OPTIONS` and `masksFor`, so neither side can drift from the other.
 */
import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { selectorFor, type ControlKey, type Side } from './selectors';

/**
 * Parked 2026-09-19: the references predate the shared page band and the wider layout, so they no
 * longer describe the page that was designed. Recapture from an updated design handoff with
 * `yarn parity:reference`, then set this to false. While true, the pixel tests report as fixme and
 * the reference check only warns.
 */
export const PIXEL_COMPARISON_PARKED = true;

/**
 * The window both sides render in. The width is the design's wide layout; the height is not the
 * height of a capture (full-page shots run to the bottom of the document), only what `vh` and
 * `position: fixed` are sized against.
 */
export const VIEWPORT = { width: 924, height: 900 } as const;

/**
 * Browser settings shared by `playwright.parity.config.ts` and
 * `playwright.reference.config.ts`.
 */
export const CAPTURE_USE = {
  viewport: VIEWPORT,
  // A scale of 1 keeps the PNG in CSS pixels on both sides, or every pixel is off by the factor.
  deviceScaleFactor: 1,
  // Anything that animates in only under `no-preference` never starts.
  reducedMotion: 'reduce',
  timezoneId: 'UTC',
  locale: 'en-CA',
  colorScheme: 'light',
  // A service worker's own fetches bypass `context.route`, so none may register.
  serviceWorkers: 'block',
} as const;

/** Screenshot options for both sides. `scale: 'css'` for the same reason as the scale factor. */
export const SHOT_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
} as const;

/**
 * Regions that could change between two runs of the same state, painted over on both sides.
 *
 * Empty on purpose, checked 2026-09-23: dates come from the fixtures and the frozen clock
 * (`freezeClock`), ids are not drawn, and /search draws no map. Both sides capture states twice
 * and fail if the two images differ, which is the signal to add an entry here. An entry names a
 * control from `selectors.ts`, so it resolves on both sides.
 */
export const MASKS: readonly { control: ControlKey; why: string }[] = [];

export function masksFor(page: Page, side: Side): Locator[] {
  return MASKS.map((mask) => page.locator(selectorFor(mask.control, side)));
}

const NETWORK_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/** True for a URL that would reach another machine; `data:` and `blob:` never leave the page. */
export function leavesMachine(url: URL): boolean {
  if (!NETWORK_PROTOCOLS.has(url.protocol)) return false;
  return !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith('.localhost');
}

/**
 * Aborts every request and web socket in the context that would leave the machine. Returns the
 * list of what was stopped, for the caller to assert empty once the page is done.
 */
export async function keepLocal(context: BrowserContext): Promise<string[]> {
  const stopped: string[] = [];
  await context.route(leavesMachine, (route) => {
    stopped.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(leavesMachine, (socket) => {
    stopped.push(socket.url());
    return socket.close();
  });
  return stopped;
}

export const STAYED_LOCAL = 'requests left the machine; answer them from e2e/fixtures';

/**
 * `test` whose context refuses the network. The app's `env.js` points at a deployed API, so a
 * call the fixtures do not answer would otherwise render live data. Context routes run after a
 * spec's own page routes, so fixtures still answer first.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    const stopped = await keepLocal(context);
    await use(context);
    expect(stopped, STAYED_LOCAL).toEqual([]);
  },
});
