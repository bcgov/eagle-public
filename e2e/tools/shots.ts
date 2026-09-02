/**
 * Route-by-route screenshots of one environment, for eyeballing the React port against the
 * deployed Angular site. Not a test: it asserts nothing, it just captures.
 *
 *   BASE_URL=... OUT=test BASIC_AUTH_USER=... BASIC_AUTH_PASS=... npx tsx tools/shots.ts
 *
 * Writes e2e/screenshots/<OUT>/<name>-<width>.png. Project and comment-period ids are resolved
 * from the API so both runs land on the same records (local dev proxies /api to test).
 */
import { chromium } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const OUT = path.join(HERE, '..', 'screenshots', process.env.OUT || 'local');
const { BASIC_AUTH_USER, BASIC_AUTH_PASS } = process.env;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

type Shot = { name: string; go: (page: Page) => Promise<void>; mobileOnly?: boolean; desktopOnly?: boolean };

async function api(pathAndQuery: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (BASIC_AUTH_USER) {
    headers.Authorization =
      'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64');
  }
  const r = await fetch(new URL(pathAndQuery, BASE_URL), { headers });
  if (!r.ok) throw new Error(`${pathAndQuery} -> ${r.status}`);
  return r.json();
}

function unwrap(body: any) {
  const e = Array.isArray(body) ? body[0] : body;
  return e?.searchResults ?? [];
}

/** The app hydrates client-side and fetches in waves; wait for it to go quiet. */
async function settle(page: Page, ms = 2500): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function goto(page: Page, url: string, ms?: number): Promise<void> {
  await page.goto(url, { waitUntil: 'commit' });
  await settle(page, ms);
}

async function main(): Promise<void> {
  const projects = unwrap(
    await api(
      '/api/search?dataset=Project&pageNum=0&pageSize=1&projectLegislation=default&sortBy=%2Bname&populate=true&fuzzy=false',
    ),
  );
  const siteC = unwrap(
    await api(
      '/api/search?dataset=Project&pageNum=0&pageSize=1&keywords=Site%20C&projectLegislation=default&sortBy=-score&populate=true&fuzzy=false',
    ),
  );
  const projId = (siteC[0] ?? projects[0])._id;
  const cps: any[] = await api(
    '/api/commentperiod?sortBy=-dateStarted&fields=project|dateStarted|dateCompleted|instructions|informationLabel',
  );
  const cp = cps.find(c => c.project && c.dateStarted && c.dateCompleted);
  console.log(`project ${projId}  comment period ${cp._id} (project ${cp.project})`);

  const plain: [string, string][] = [
    ['home', '/'],
    ['projects-list', '/projects-list'],
    ['news', '/news'],
    ['project-notifications', '/project-notifications'],
    ['search', '/search'],
    ['search-help', '/search-help'],
    ['legislation', '/legislation'],
    ['process', '/process'],
    ['compliance-oversight', '/compliance-oversight'],
    ['contact', '/contact'],
    ['cac-unsubscribe', '/cac-unsubscribe'],
    ['project-details', `/p/${projId}/project-details`],
    ['project-documents', `/p/${projId}/documents`],
    ['project-commenting', `/p/${projId}/commenting`],
    ['project-decisions', `/p/${projId}/decisions`],
    ['project-certificates', `/p/${projId}/certificates`],
    ['project-amendments', `/p/${projId}/amendments`],
    ['project-application', `/p/${projId}/application`],
    ['comment-period', `/p/${cp.project}/cp/${cp._id}/details`],
  ];

  async function openCommentModal(p: Page): Promise<void> {
    await goto(p, `/p/${cp.project}/cp/${cp._id}/details`);
    await p.getByRole('button', { name: 'Submit Comment' }).first().click();
    await p.waitForTimeout(1500);
  }

  const shots: Shot[] = [
    ...plain.map(([name, url]): Shot => ({ name, go: p => goto(p, url) })),

    { name: 'projects-map', go: p => goto(p, '/projects', 5000) },
    {
      name: 'projects-map-popup',
      go: async p => {
        await goto(p, '/projects', 5000);
        // Drill through clusters until a single-project pin is on screen, then open its card.
        for (let i = 0; i < 6; i++) {
          const marker = p.locator('[data-testid="map-marker"]').first();
          if (await marker.isVisible()) break;
          await p.locator('[data-testid="map-cluster"]').first().click();
          await p.waitForTimeout(1200);
        }
        await p.locator('[data-testid="map-marker"]').first().click();
        await p.waitForTimeout(1500);
      },
    },
    {
      name: 'projects-map-sheet-full',
      mobileOnly: true,
      go: async p => {
        await goto(p, '/projects', 5000);
        // The handle cycles peek -> half -> full.
        await p.locator('.sheet-handle').click();
        await p.waitForTimeout(600);
        await p.locator('.sheet-handle').click();
        await p.waitForTimeout(1200);
      },
    },
    {
      name: 'search-results',
      go: async p => {
        await goto(p, '/search?keywords=water&currentPage=1&pageSize=10&sortBy=-score');
      },
    },
    {
      name: 'search-filtered',
      go: async p => {
        await goto(
          p,
          '/search?keywords=water&currentPage=1&pageSize=10&sortBy=-score&documentAuthorType=Proponent%2FCertificate+Holder',
        );
      },
    },
    {
      name: 'search-filters-open',
      go: async p => {
        await goto(p, '/search');
        const toggle = p.getByRole('button', { name: /filter/i }).first();
        if (await toggle.count()) await toggle.click();
        await p.waitForTimeout(1000);
      },
    },
    {
      name: 'add-comment',
      go: async p => {
        await openCommentModal(p);
      },
    },
    {
      // Page 1's Next is disabled until the conditions box is ticked. Nothing is ever submitted.
      name: 'add-comment-page2',
      go: async p => {
        await openCommentModal(p);
        await p.locator('input[name="agreeConditions"]').check();
        await p.getByRole('button', { name: /^Next$/ }).click();
        await p.waitForTimeout(1200);
      },
    },
    {
      name: 'add-comment-page3',
      go: async p => {
        await openCommentModal(p);
        await p.locator('input[name="agreeConditions"]').check();
        await p.getByRole('button', { name: /^Next$/ }).click();
        await p.waitForTimeout(1200);
        // The CAC invitation only appears for projects that have one; skip past it when it does.
        const noThanks = p.getByRole('button', { name: 'No Thanks' });
        if (await noThanks.count()) {
          await noThanks.click();
          await p.waitForTimeout(1200);
        }
      },
    },
    {
      name: 'header-dropdown-1',
      desktopOnly: true,
      go: async p => {
        await goto(p, '/');
        // Both builds open these menus on CSS hover; the toggle itself has pointer-events: none.
        await p.locator('header li.dropdown').filter({ hasText: 'Project Information' }).hover();
        await p.waitForTimeout(600);
      },
    },
    {
      name: 'header-dropdown-2',
      desktopOnly: true,
      go: async p => {
        await goto(p, '/');
        await p.locator('header li.dropdown').filter({ hasText: 'The EA Process' }).hover();
        await p.waitForTimeout(600);
      },
    },
    {
      name: 'mobile-menu',
      mobileOnly: true,
      go: async p => {
        await goto(p, '/');
        await p.locator('button.navbar-toggler, .navbar-toggler').first().click();
        await p.waitForTimeout(800);
      },
    },
    {
      name: 'footer',
      go: async p => {
        await goto(p, '/');
        await p.locator('footer').first().scrollIntoViewIfNeeded();
        await p.waitForTimeout(500);
      },
    },
  ];

  fs.mkdirSync(OUT, { recursive: true });
  // MapLibre needs WebGL; headless chromium has no GPU, so it software-renders.
  const browser: Browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  for (const vp of VIEWPORTS) {
    const context: BrowserContext = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      ...(BASIC_AUTH_USER && BASIC_AUTH_PASS
        ? { httpCredentials: { username: BASIC_AUTH_USER, password: BASIC_AUTH_PASS } }
        : {}),
    });
    // The ACCESS_GATE curtain remembers a plain sessionStorage flag.
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('eagle-gate', '1');
      } catch {
        /* ignored */
      }
    });
    const page = await context.newPage();
    page.on('pageerror', e => console.log(`  ! pageerror: ${e.message}`));

    for (const shot of shots) {
      if (ONLY && !ONLY.test(shot.name)) continue;
      if (shot.mobileOnly && vp.name !== 'mobile') continue;
      if (shot.desktopOnly && vp.name !== 'desktop') continue;
      const file = path.join(OUT, `${shot.name}-${vp.name}.png`);
      try {
        await shot.go(page);
        await page.screenshot({ path: file, fullPage: shot.name !== 'footer' });
        console.log(`  ${vp.name} ${shot.name}`);
      } catch (e) {
        console.log(`  ${vp.name} ${shot.name}  FAILED: ${(e as Error).message.split('\n')[0]}`);
        await page.screenshot({ path: file }).catch(() => {});
      }
    }
    await context.close();
  }

  await browser.close();
  console.log(`written to ${OUT}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
