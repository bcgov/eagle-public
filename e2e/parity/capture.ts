/**
 * What makes two captures of a page come out the same. Both configs and both capture sides read
 * `CAPTURE_USE`, `SHOT_OPTIONS` and `masksFor` from here, so neither side can drift.
 */
import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { GATE_KEY } from '../support/fixtures';
import { selectorFor, type ControlKey, type Side } from './selectors';

/**
 * `PARITY_HOST`: origin of a deployed build to check instead of the local preview. Only the origin
 * is kept, so a path in the value cannot widen what the network guard lets through.
 */
export const PARITY_HOST: string | undefined = process.env['PARITY_HOST']
  ? new URL(process.env['PARITY_HOST']).origin
  : undefined;

/**
 * The references lack the shared page band and wide layout. While true the pixel group skips and
 * the reference check only warns; recapture with `yarn parity:reference`, then set false.
 */
export const PIXEL_COMPARISON_PARKED = true;

/**
 * The window both sides render in: the design's wide layout. The height is what `vh` and
 * `position: fixed` size against, not the capture height; full-page shots run to the bottom.
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
 * Controls that change between two runs of a state, painted over on both sides. Empty: dates are
 * frozen and /search draws no map. A "captures the same twice" failure is the cue to add one.
 */
export const MASKS: readonly { control: ControlKey; why: string }[] = [];

export function masksFor(page: Page, side: Side): Locator[] {
  return MASKS.map((mask) => page.locator(selectorFor(mask.control, side)));
}

const NETWORK_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/**
 * True for a URL that would reach another machine; `data:` and `blob:` never leave the page.
 * `host` is the one remote origin allowed: the deployed build under test, when there is one.
 */
export function leavesMachine(url: URL, host: string | undefined = PARITY_HOST): boolean {
  if (!NETWORK_PROTOCOLS.has(url.protocol)) return false;
  if (host !== undefined && url.origin === host) return false;
  return !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith('.localhost');
}

/**
 * Aborts every request and web socket that would leave the machine, other than to `host`. Returns
 * what was stopped, for the caller to assert empty once the page is done.
 */
export async function keepLocal(
  context: BrowserContext,
  host: string | undefined = PARITY_HOST,
): Promise<string[]> {
  const stopped: string[] = [];
  const leaves = (url: URL) => leavesMachine(url, host);
  await context.route(leaves, (route) => {
    stopped.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(leaves, (socket) => {
    stopped.push(socket.url());
    return socket.close();
  });
  return stopped;
}

/**
 * On a deployed host, marks the access gate as passed before every page load, the same seed the
 * main suite uses. The local preview has no gate, so there it adds nothing.
 */
export async function passGate(context: BrowserContext): Promise<void> {
  if (PARITY_HOST === undefined) return;
  await context.addInitScript((key) => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* about:blank and opaque-origin frames have no storage, and no gate */
    }
  }, GATE_KEY);
}

export const STAYED_LOCAL = 'requests left the machine; answer them from e2e/fixtures';

/**
 * `test` whose context refuses the network, so a call the fixtures miss cannot render live data.
 * Context routes run after a spec's page routes, so fixtures still answer first.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    const stopped = await keepLocal(context);
    await passGate(context);
    await use(context);
    expect(stopped, STAYED_LOCAL).toEqual([]);
  },
});
