/**
 * Dumps a comparable outline of every route on one environment: visible text plus a tag/class
 * skeleton. Diffing two dumps finds missing elements, wrong text and wrong classes far faster
 * than comparing screenshots.
 *
 *   BASE_URL=... OUT=test BASIC_AUTH_USER=... BASIC_AUTH_PASS=... node tools/dom-dump.ts
 *
 * Writes e2e/screenshots/<OUT>.dom.txt (same gitignored directory as the shots).
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BASE_URL = process.env['BASE_URL'] || 'http://localhost:4200';
const OUT = path.join(HERE, '..', 'screenshots', `${process.env['OUT'] || 'local'}.dom.txt`);
const { BASIC_AUTH_USER, BASIC_AUTH_PASS } = process.env;
const WIDTH = Number(process.env['WIDTH'] || 1280);
const HEIGHT = Number(process.env['HEIGHT'] || 800);

async function api(q: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (BASIC_AUTH_USER) {
    headers['Authorization'] =
      'Basic ' + Buffer.from(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`).toString('base64');
  }
  const r = await fetch(new URL(q, BASE_URL), { headers });
  if (!r.ok) throw new Error(`${q} -> ${r.status}`);
  return r.json();
}

/**
 * Flat list of `tag.class | text` for every rendered element, with the framework's own wrapper
 * elements dropped so an Angular tree and a React tree line up: Angular component hosts
 * (`app-header`, `lib-pagination`, `router-outlet`) and React's class-less `<div>` wrappers carry
 * no visual meaning, and only one of the two frameworks emits each.
 */
function outline(): string {
  const lines: string[] = [];
  const walk = (el: Element): void => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'noscript') return;
    const cls = (el.getAttribute('class') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((c) => !/^ng-|^_ng|^cdk-/.test(c))
      .sort()
      .join('.');
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    const structural = (tag.includes('-') || tag === 'div' || tag === 'span') && !cls && !own;
    if (!structural) lines.push(`${tag}${cls ? '.' + cls : ''}${own ? ` | ${own}` : ''}`);
    for (const c of [...el.children]) walk(c);
  };
  walk(document.body);
  return lines.join('\n');
}

async function settle(page: Page, ms = 2500): Promise<void> {
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

  const out: string[] = [];
  for (const [name, url] of routes) {
    await page.goto(url, { waitUntil: 'commit' });
    await settle(page, name === 'projects-map' ? 5000 : 2500);
    out.push(`\n\n########## ${name} ${url}\n`);
    out.push(await page.evaluate(outline));
    console.log(`  ${name}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out.join('\n'));
  await browser.close();
  console.log(`written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
