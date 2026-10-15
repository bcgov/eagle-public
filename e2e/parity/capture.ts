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

import { GATE_KEY } from '../support/fixtures';
import { selectorFor, type ControlKey, type Side } from './selectors';

/**
 * Origin of a deployed build to check instead of the local preview, read from `PARITY_HOST`
 * (for example `https://<endpoint>.azurefd.net`). Unset means the local preview, as before. Only
 * the origin is kept, so a path in the value cannot widen what the network guard lets through.
 */
export const PARITY_HOST: string | undefined = process.env['PARITY_HOST']
  ? new URL(process.env['PARITY_HOST']).origin
  : undefined;

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
 * Aborts every request and web socket in the context that would leave the machine, other than
 * those to `host`. Returns the list of what was stopped, for the caller to assert empty once the
 * page is done.
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
 * `test` whose context refuses the network. The app's `env.js` points at a deployed API, so a
 * call the fixtures do not answer would otherwise render live data. Context routes run after a
 * spec's own page routes, so fixtures still answer first.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    const stopped = await keepLocal(context);
    await passGate(context);
    await use(context);
    expect(stopped, STAYED_LOCAL).toEqual([]);
  },
});
