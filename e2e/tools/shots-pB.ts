/**
 * Static-page + chrome screenshots for the pB parity slice.
 *
 *   BASE_URL=... OUT=test BASIC_AUTH_USER=... BASIC_AUTH_PASS=... GATE_PASSWORD=... \
 *     npx tsx tools/shots-pB.ts
 *
 * Writes e2e/screenshots/pB/<OUT>/<name>-<viewport>.png. Asserts nothing.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BASE_URL = process.env.BASE_URL || 'http://localhost:4302';
const OUT = path.join(HERE, '..', 'screenshots', 'pB', process.env.OUT || 'local');
const { BASIC_AUTH_USER, BASIC_AUTH_PASS, GATE_PASSWORD } = process.env;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const ROUTES: [string, string][] = [
  ['home', '/'],
  ['contact', '/contact'],
  ['legislation', '/legislation'],
  ['process', '/process'],
  ['compliance-oversight', '/compliance-oversight'],
  ['search-help', '/search-help'],
  ['cac-unsubscribe', '/cac-unsubscribe'],
];

async function settle(page: Page, ms = 1500): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Opens the shared-password curtain when the environment has one. */
async function unlock(page: Page): Promise<void> {
  const field = page.locator('#gate-password');
  if (!GATE_PASSWORD) return;
  if ((await field.count()) === 0) return;
  await field.fill(GATE_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  await settle(page);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      ...(BASIC_AUTH_USER
        ? { httpCredentials: { username: BASIC_AUTH_USER, password: BASIC_AUTH_PASS! } }
        : {}),
    });
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('eagle-gate', '1');
      } catch {
        /* ignored */
      }
    });
    const page = await context.newPage();
    await page.goto(new URL('/', BASE_URL).href, { waitUntil: 'commit' });
    await settle(page);
    await unlock(page);

    const shot = async (name: string, opts: { full?: boolean; clip?: boolean } = {}) => {
      const file = path.join(OUT, `${name}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: opts.full !== false });
      console.log(file);
    };

    for (const [name, route] of ROUTES) {
      if (ONLY && !ONLY.test(name)) continue;
      await page.goto(new URL(route, BASE_URL).href, { waitUntil: 'commit' });
      await settle(page);
      await shot(name);
    }

    // Chrome: header, dropdowns, hamburger, footer, scroll-to-top, env banner.
    await page.goto(new URL('/', BASE_URL).href, { waitUntil: 'commit' });
    await settle(page);

    const header = page.locator('#header').first();
    await header.screenshot({ path: path.join(OUT, `header-${vp.name}.png`) }).catch(() => {});

    if (vp.name === 'desktop') {
      for (const id of ['searchProjects', 'aboutMMTI']) {
        await page.evaluate(i => document.getElementById(i)?.click(), id);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(OUT, `dropdown-${id}-${vp.name}.png`),
          clip: { x: 0, y: 0, width: vp.width, height: Math.min(700, vp.height) },
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(OUT, `dropdown-${id}-after-escape-${vp.name}.png`),
          clip: { x: 0, y: 0, width: vp.width, height: 300 },
        });
        // Make sure it is shut before the next one.
        await page.evaluate(i => document.getElementById(i)?.click(), id);
        await page.waitForTimeout(200);
        await page.mouse.click(vp.width - 5, vp.height - 5);
        await page.waitForTimeout(200);
      }
    } else {
      await page.evaluate(() => (document.querySelector('.navbar-toggler') as HTMLElement)?.click());
      await page.waitForTimeout(600);
      await shot('hamburger-open');
      await page.evaluate(() => document.getElementById('searchProjects')?.click());
      await page.waitForTimeout(400);
      await shot('hamburger-dropdown-open');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await shot('hamburger-after-escape');
      await page.reload({ waitUntil: 'commit' });
      await settle(page);
    }

    // Footer + scroll-to-top: scroll to the bottom of a long static page.
    await page.goto(new URL('/legislation', BASE_URL).href, { waitUntil: 'commit' });
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `footer-${vp.name}.png`), fullPage: false });
    console.log(path.join(OUT, `footer-${vp.name}.png`));

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `scrolltop-${vp.name}.png`), fullPage: false });
    console.log(path.join(OUT, `scrolltop-${vp.name}.png`));

    await context.close();
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
