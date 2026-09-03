import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const HEX24 = /^[0-9a-f]{24}$/i;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/;

/** Query params whose value changes on every page load and carries no parity signal. */
export const VOLATILE_PARAMS = new Set(['cpStart[since]', 'cpEnd[until]']);

/** API paths worth recording. Everything else (assets, map tiles) is noise. */
const API_PATH = /^\/(api|demi-search|eagle-search|analytics)(\/|$|\?)/;

/**
 * Path + sorted query with ids and timestamps masked, so the same call made about a
 * different project/document/env collapses to one comparable string.
 */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  const p = u.pathname
    .split('/')
    .map((s) => (HEX24.test(s) ? ':id' : s))
    .join('/');
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !VOLATILE_PARAMS.has(k))
    .map(([k, v]): [string, string] => [k, HEX24.test(v) ? ':id' : ISO_TS.test(v) ? ':ts' : v])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  const qs = params.map(([k, v]) => `${k}=${v}`).join('&');
  return qs ? `${p}?${qs}` : p;
}

/** Starts collecting normalized API calls. Attach before navigating. */
export function recordApiCalls(page: Page): Set<string> {
  const seen = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (API_PATH.test(u.pathname + (u.search ? '?' : ''))) {
      seen.add(`${r.method()} ${normalizeUrl(r.url())}`);
    }
  });
  return seen;
}

const BASELINE_FILE = path.join(__dirname, '..', 'baseline', 'requests.json');

function loadBaseline(): Record<string, string[]> {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Write mode (`yarn baseline`, single worker) records the calls; normal runs assert the
 * page still issues exactly the recorded set.
 */
export function checkBaseline(key: string, observed: Set<string>): void {
  const list = [...observed].sort();
  if (process.env['BASELINE_WRITE']) {
    const all = loadBaseline();
    all[key] = list;
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(all, Object.keys(all).sort(), 2) + '\n');
    return;
  }
  const expected = loadBaseline()[key];
  expect(expected, `no baseline entry "${key}" - run: yarn baseline`).toBeDefined();
  expect(normalise(list)).toEqual(normalise(expected));
}

/**
 * Deliberate request changes in the React port, listed in `docs/deviations-from-angular.md`. Applied to
 * both sides so the baseline still fails on anything undocumented.
 */
function normalise(lines: string[]): string[] {
  return lines
    .filter((line) => !DROPPED.some((pattern) => pattern.test(line)))
    .map(applyDeviations);
}

/** Calls Angular made that the port no longer makes; each is an entry in `docs/deviations-from-angular.md`. */
const DROPPED = [
  // `getExtraAppData`: two `dataset=Item&_schemaName=User` lookups whose results nothing rendered.
  /^GET \/api\/search\?_id=:id&_schemaName=User&dataset=Item$/,
  // The pageSize=1 probes that decide which document-type tabs to show. They now belong to the
  // Documents tab rather than every project page, and one of them asks about Compliance &
  // Enforcement documents, which Angular has no tab for. `documents-page.spec.tsx` covers them.
  /^GET \/(api|demi-search|eagle-search)\/search\?.*&pageSize=1&/,
  // Bulk download. Angular had none: single downloads now go through demi-api for a presigned
  // URL, and the bulk bar polls the job. Both are entries in `docs/deviations-from-angular.md`.
  /^POST \/(api|demi-search)\/bulk-downloads$/,
  /^GET \/(api|demi-search)\/bulk-downloads\//,
];

function applyDeviations(line: string): string {
  return (
    line
      // `&fields=` is no longer sent on search calls: eagle-api never read it, and prod sends either
      // an empty value or the literal `[object Object]`.
      .replace(/&fields=(\[object Object\])?(?=&|$)/, '')
      // The pins table asks for the sort its header shows (+name). Angular's pins service sent its
      // own default, -datePosted, while the header displayed +name.
      .replace(
        '/pin?pageNum=0&pageSize=10&sortBy=-datePosted',
        '/pin?pageNum=0&pageSize=10&sortBy= name',
      )
  );
}

/** Envelope both /api/search and /demi-search/search answer with. */
export interface SearchEnvelope {
  searchResults: any[];
  meta: { searchResultsTotal: number }[];
}

export function unwrap(body: any): SearchEnvelope {
  const e = Array.isArray(body) ? body[0] : body;
  return { searchResults: e?.searchResults ?? [], meta: e?.meta ?? [{ searchResultsTotal: 0 }] };
}

export function total(env: SearchEnvelope): number {
  return env.meta?.[0]?.searchResultsTotal ?? 0;
}

/**
 * Promise for the next search response for `dataset` on either search backend.
 * The project shell fires extra `dataset=Document` probes (pageSize=1 tab checks,
 * pageSize=5 featured docs), so `mustContain` picks the call that fills the table.
 */
export function waitForSearch(page: Page, dataset: string, mustContain = '') {
  return page
    .waitForResponse(
      (r) =>
        /\/(api|demi-search|eagle-search)\/?search\?/.test(r.url()) &&
        r.url().includes(`dataset=${dataset}`) &&
        r.url().includes(mustContain) &&
        r.status() === 200,
      { timeout: 60_000 },
    )
    .then(async (r) => unwrap(await r.json()));
}

/** The app hydrates client-side; wait for the h1 to exist, then let XHRs settle. */
export async function ready(page: Page, settleMs = 2500): Promise<void> {
  await page.locator('h1').first().waitFor({ state: 'attached', timeout: 90_000 });
  // The page fetches in waves after hydration - config, then the lists, then the table, then the
  // per-row lookups - so wait for the network to go quiet instead of guessing how long that takes.
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {
    // networkidle never settles on a page that keeps polling; the timed wait below covers it
  });
  await page.waitForTimeout(settleMs);
}

/** Accessibility smoke facts every page must hold. */
export async function expectA11ySmoke(page: Page): Promise<{ skipLinks: number }> {
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('img:not([alt])')).toHaveCount(0);
  return {
    skipLinks: await page
      .locator('a.skip-link, a.skip-to-content, a[href="#main"], a[href="#content"]')
      .count(),
  };
}

/**
 * "Showing 10 of 348 results" -> { shown: 10, total: 348 }. A selectable table carries the line in
 * its header bar instead of the top row, so both hooks are accepted.
 */
export async function pageCount(page: Page): Promise<{ shown: number; total: number }> {
  const text = await page
    .locator('[id^="table-template-page-count-display"], .table-header-bar__count')
    .first()
    .innerText();
  const m = text.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/i);
  expect(m, `unexpected page count text: "${text}"`).not.toBeNull();
  return { shown: Number(m![1].replace(/,/g, '')), total: Number(m![2].replace(/,/g, '')) };
}

/**
 * Fixture lookups must not die when the backend under test is unavailable, otherwise a
 * real difference reads as a crashed suite. /demi-search is the live path; /api/search
 * answers the same envelope and is the fallback (the test environment gates
 * /demi-search behind HTTP basic auth).
 */
async function searchFixture(request: APIRequestContext, query: string): Promise<any[]> {
  for (const base of ['/demi-search/search', '/api/search']) {
    const r = await request.get(`${base}?${query}`);
    if (r.status() === 200) {
      try {
        return unwrap(await r.json()).searchResults;
      } catch {
        /* not JSON: fall through to the next backend */
      }
    }
  }
  throw new Error(`no search backend answered ${query}`);
}

/** First published projects, sorted by name so the pick is stable per environment. */
export async function firstProjects(request: APIRequestContext, n = 2): Promise<any[]> {
  const results = await searchFixture(
    request,
    `dataset=Project&pageNum=0&pageSize=${n}&projectLegislation=default&sortBy=%2Bname&populate=true&fuzzy=false`,
  );
  expect(results.length, 'no projects on this environment').toBeGreaterThan(0);
  return results;
}

/** Named project, so tab coverage lands on one that actually has documents. */
export async function projectByKeyword(request: APIRequestContext, keyword: string): Promise<any> {
  const results = await searchFixture(
    request,
    `dataset=Project&pageNum=0&pageSize=1&keywords=${encodeURIComponent(keyword)}&projectLegislation=default&sortBy=-score&populate=true&fuzzy=false`,
  );
  return results[0] ?? (await firstProjects(request, 1))[0];
}

/** Most recent comment period plus its project id. */
export async function latestCommentPeriod(request: APIRequestContext): Promise<any> {
  const r = await request.get(
    '/api/commentperiod?sortBy=-dateStarted&fields=project|dateStarted|dateCompleted|instructions|informationLabel',
  );
  expect(r.status()).toBe(200);
  const list = await r.json();
  const cp = list.find((c: any) => c.project && c.dateStarted && c.dateCompleted);
  expect(cp, 'no comment period with a project on this environment').toBeTruthy();
  return cp;
}

export function isOpen(cp: any): boolean {
  const now = Date.now();
  return Date.parse(cp.dateStarted) <= now && now <= Date.parse(cp.dateCompleted);
}
