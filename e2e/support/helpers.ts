import { expect } from '@playwright/test';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const HEX24 = /^[0-9a-f]{24}$/i;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/;

/** Query params whose value changes on every page load and carries no parity signal. */
export const VOLATILE_PARAMS = new Set(['cpStart[since]', 'cpEnd[until]']);

/**
 * API paths worth recording. Everything else (assets, map tiles) is noise. `api` and `eagle-search`
 * stay in the list although the app no longer calls either: a call that comes back gets recorded
 * and fails the baseline instead of passing unnoticed.
 */
const API_PATH = /^\/(api|demi-search|eagle-search|demi-projects)(\/|$|\?)/;

/**
 * Analytics ingest, under either path rproxy serves it on. It flushes on a timer, so whether it
 * lands inside a recording window is luck.
 */
const TELEMETRY_PATH = /^\/(api\/usage|analytics)(\/|$)/;

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
    if (API_PATH.test(u.pathname + (u.search ? '?' : '')) && !TELEMETRY_PATH.test(u.pathname)) {
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
  // The pageSize=1 probes that decide which sections and document sub-tabs to show. They fire on
  // every project page, and one asks about Compliance & Enforcement documents, which Angular has no
  // tab for. `documents-page.spec.tsx` and `project.spec.tsx` cover them.
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

/** Envelope /demi-search/search answers with. */
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

/** The home strip's read, whichever backend serves it. */
export function isTopNewsUrl(url: string): boolean {
  return (
    url.includes('/public/recentActivity?top=true') ||
    (url.includes('dataset=RecentActivity') && /[?&]top=true/.test(url))
  );
}

/** Its rows: eagle-api answers a bare array, demi-search the search envelope. */
export function topNewsRows(body: any): any[] {
  return Array.isArray(body) && !body[0]?.searchResults ? body : unwrap(body).searchResults;
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
 * its header bar instead of the top row, so both hooks are accepted. The documents table drops the
 * "Showing" prefix once every item fits on one page ("1,284 documents"), or reads "No documents"
 * when the total is zero: both are folded into the same shown/total shape here.
 */
export async function pageCount(page: Page): Promise<{ shown: number; total: number }> {
  const text = await page
    .locator(
      '[id^="table-template-page-count-display"], [id^="data-table-page-count-display"], .table-header-bar__count, .data-table__bar-count',
    )
    .first()
    .innerText();
  if (/^no\s+\S+/i.test(text.trim())) {
    return { shown: 0, total: 0 };
  }
  const showing = text.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/i);
  if (showing) {
    return {
      shown: Number(showing[1].replace(/,/g, '')),
      total: Number(showing[2].replace(/,/g, '')),
    };
  }
  const single = text.match(/^([\d,]+)\s+\S+/);
  expect(single, `unexpected page count text: "${text}"`).not.toBeNull();
  const n = Number(single![1].replace(/,/g, ''));
  return { shown: n, total: n };
}

/**
 * The display grid's toolbar count: "1–25 of 340 projects" -> { first: 1, last: 25, total: 340 }.
 * "No projects" reads as all zeros. A selection replaces the line with "3 selected", which has no
 * range, so callers that select rows read the text itself.
 */
export async function gridCount(
  page: Page,
): Promise<{ first: number; last: number; total: number }> {
  const text = (await page.locator('.display-grid__count').first().innerText()).trim();
  if (/^no\s+\S+/i.test(text)) return { first: 0, last: 0, total: 0 };
  const range = text.match(/^([\d,]+)\s*[–-]\s*([\d,]+)\s+of\s+([\d,]+)\s/);
  expect(range, `unexpected grid count text: "${text}"`).not.toBeNull();
  const asNumber = (raw: string) => Number(raw.replace(/,/g, ''));
  return {
    first: asNumber(range![1]),
    last: asNumber(range![2]),
    total: asNumber(range![3]),
  };
}

/**
 * A fixture response's JSON. An unproxied path is answered by the SPA with 200 text/html, so
 * without the content-type check that failure surfaces as a parse error far from its cause.
 */
export async function jsonBody(r: APIResponse, what: string): Promise<any> {
  expect(r.status(), `${what}: ${r.url()} answered HTTP ${r.status()}`).toBe(200);
  const contentType = r.headers()['content-type'] ?? '';
  expect(
    contentType,
    `${what}: ${r.url()} answered ${contentType || 'no content-type'}, not JSON - the SPA fallback served this`,
  ).toContain('application/json');
  return r.json();
}

/**
 * `/demi-search/search` is the only backend, and the path the app itself uses. The app never asks
 * these questions - this is how the suite finds ids to navigate to.
 */
export async function searchFixture(request: APIRequestContext, query: string): Promise<any[]> {
  const r = await request.get(`/demi-search/search?${query}`);
  return unwrap(await jsonBody(r, `search ${query}`)).searchResults;
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

/** A project's comment periods, newest first - the read `api.getPeriodsByProjId` makes. */
export async function commentPeriodsOf(
  request: APIRequestContext,
  projectId: string,
  pageSize = 5,
): Promise<any[]> {
  return searchFixture(
    request,
    `dataset=CommentPeriod&sortBy=-dateStarted&pageNum=0&pageSize=${pageSize}&and[project]=${projectId}`,
  );
}

/** How many projects the comment-period pick walks before giving up. */
const CP_PROJECT_SCAN = 10;

/**
 * A comment period plus its project id. demi-search answers `dataset=CommentPeriod` only when the
 * query filters on `project` or `_id` - an unfiltered one is 0 rows - so the pick walks the same
 * name-sorted projects `firstProjects` returns and takes the newest period of the first one that
 * has any. Stable per environment, because the project order is.
 */
export async function latestCommentPeriod(request: APIRequestContext): Promise<any> {
  for (const project of await firstProjects(request, CP_PROJECT_SCAN)) {
    const cp = (await commentPeriodsOf(request, project._id)).find(
      (c: any) => c.project && c.dateStarted && c.dateCompleted,
    );
    if (cp) return cp;
  }
  throw new Error(`no comment period on the first ${CP_PROJECT_SCAN} projects of this environment`);
}

export function isOpen(cp: any): boolean {
  const now = Date.now();
  return Date.parse(cp.dateStarted) <= now && now <= Date.parse(cp.dateCompleted);
}
