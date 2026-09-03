/**
 * Records the computed style of every rendered element on every route, keyed by the same
 * `tag.class` outline `dom-dump.ts` produces. `style-diff.py` aligns two dumps and reports the
 * properties that differ, which is how a CSS rule that lost a specificity fight in the port
 * (Angular's encapsulation attribute used to win it) shows up as one line instead of a screenshot.
 *
 *   BASE_URL=... OUT=test BASIC_AUTH_USER=... BASIC_AUTH_PASS=... node tools/style-dump.ts
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const OUT = path.join(HERE, '..', 'screenshots', `${process.env.OUT || 'local'}.styles.json`);
const { BASIC_AUTH_USER, BASIC_AUTH_PASS } = process.env;
const WIDTH = Number(process.env.WIDTH || 1280);
const HEIGHT = Number(process.env.HEIGHT || 800);

const PROPS = [
  'display',
  'position',
  'float',
  'visibility',
  'opacity',
  'overflow-x',
  'overflow-y',
  'z-index',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'white-space',
  'color',
  'background-color',
  'background-image',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-color',
  'border-top-style',
  'border-radius',
  'box-shadow',
  'width',
  'height',
  'max-width',
  'min-height',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'flex-wrap',
];

async function api(q: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (BASIC_AUTH_USER) {
    headers.Authorization =
      'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64');
  }
  const r = await fetch(new URL(q, BASE_URL), { headers });
  if (!r.ok) throw new Error(`${q} -> ${r.status}`);
  return r.json();
}

function collect(props: string[]): [string, Record<string, string>][] {
  const rows: [string, Record<string, string>][] = [];
  const walk = (el: Element): void => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'noscript') return;
    const cls = (el.getAttribute('class') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((c) => !/^ng-|^_ng|^cdk-/.test(c))
      .sort()
      .join('.');
    const structural = (tag.includes('-') || tag === 'div' || tag === 'span') && !cls;
    if (!structural) {
      const cs = getComputedStyle(el);
      const style: Record<string, string> = {};
      for (const p of props) style[p] = cs.getPropertyValue(p);
      rows.push([`${tag}${cls ? '.' + cls : ''}`, style]);
    }
    for (const c of [...el.children]) walk(c);
  };
  walk(document.body);
  return rows;
}

async function settle(page: Page, ms: number): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {
    // networkidle never settles on a page that keeps polling; the timed wait below covers it
  });
  await page.waitForTimeout(ms);
}

async function main(): Promise<void> {
  const first = await api(
    '/api/search?dataset=Project&pageNum=0&pageSize=1&keywords=Site%20C&projectLegislation=default&sortBy=-score&populate=true&fuzzy=false',
  );
  const projId = (Array.isArray(first) ? first[0] : first).searchResults[0]._id;
  const cps: any[] = await api(
    '/api/commentperiod?sortBy=-dateStarted&fields=project|dateStarted|dateCompleted',
  );
  const cp = cps.find((c) => c.project && c.dateStarted && c.dateCompleted)!;

  const routes: [string, string][] = [
    ['home', '/'],
    ['projects-list', '/projects-list'],
    ['news', '/news'],
    ['project-notifications', '/project-notifications'],
    ['search', '/search'],
    ['search-results', '/search?keywords=water&currentPage=1&pageSize=10&sortBy=-score'],
    ['search-help', '/search-help'],
    ['legislation', '/legislation'],
    ['process', '/process'],
    ['compliance-oversight', '/compliance-oversight'],
    ['contact', '/contact'],
    ['cac-unsubscribe', '/cac-unsubscribe'],
    ['projects-map', '/projects'],
    ['project-details', `/p/${projId}/project-details`],
    ['project-documents', `/p/${projId}/documents`],
    ['project-commenting', `/p/${projId}/commenting`],
    ['project-certificates', `/p/${projId}/certificates`],
    ['project-amendments', `/p/${projId}/amendments`],
    ['project-application', `/p/${projId}/application`],
    ['comment-period', `/p/${cp.project}/cp/${cp._id}/details`],
  ];

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: WIDTH, height: HEIGHT },
    ...(BASIC_AUTH_USER && BASIC_AUTH_PASS
      ? { httpCredentials: { username: BASIC_AUTH_USER, password: BASIC_AUTH_PASS } }
      : {}),
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('eagle-gate', '1');
    } catch {
      /* ignored */
    }
  });
  const page = await context.newPage();

  const out: Record<string, [string, Record<string, string>][]> = {};
  for (const [name, url] of routes) {
    await page.goto(url, { waitUntil: 'commit' });
    await settle(page, name === 'projects-map' ? 5000 : 2500);
    out[name] = await page.evaluate(collect, PROPS);
    console.log(`  ${name} (${out[name].length} elements)`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  await browser.close();
  console.log(`written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
