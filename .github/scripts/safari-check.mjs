#!/usr/bin/env node
// Loads a few public pages in real Safari (safaridriver) and Playwright WebKit, prints a
// PASS/FAIL table. Inputs come from env: BASE_URL, PATHS, GATE, ENGINES, SHOT_DIR, PLAYWRIGHT_DIR.
// `node safari-check.mjs --self-test` runs the helper checks only.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const PDF_PATH = '/api/document/58868f2be036fb0105767ea5/fetch/x.pdf';
const SHELL_TIMEOUT_MS = 30_000;
const ROWS_TIMEOUT_MS = 10_000;
const DRIVER_PORT = 4444;

function parseBaseUrl(raw) {
  const url = new URL(String(raw || '').trim());
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`base_url must be http(s): ${raw}`);
  return url.origin;
}

function parsePaths(raw) {
  return String(raw || '')
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('/') ? p : `/${p}`));
}

function parseBool(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  return /^(1|true|yes)$/i.test(String(raw).trim());
}

function slug(engine, path) {
  return `${engine}${path.replace(/[^A-Za-z0-9]+/g, '-')}`.replace(/-+$/, '') || engine;
}

// Runs in the page. Shared by both engines so they judge the same things.
const PAGE_STATE = `
  const root = document.querySelector('app-root');
  const visible = (el) => el.getClientRects().length > 0;
  const staticLoading = !!root && [...root.querySelectorAll('main > p')].some((p) => p.textContent.trim() === 'Loading…');
  return {
    hasRoot: !!root,
    staticLoading,
    unavailable: !!root && /EPIC is temporarily unavailable/.test(root.textContent),
    gate: !!document.querySelector('app-gate'),
    tables: document.querySelectorAll('table').length,
    rows: [...document.querySelectorAll('table tbody tr')].filter(visible).length,
    title: document.title,
    url: location.href,
    contentType: document.contentType,
  };`;

function judge(state) {
  if (!state) return 'no page state';
  if (!state.hasRoot) return '<app-root> missing';
  if (state.unavailable) return '"EPIC is temporarily unavailable" shown';
  if (state.staticLoading) return `static "Loading…" still shown after ${SHELL_TIMEOUT_MS / 1000}s`;
  if (state.gate) return 'access gate shown';
  return '';
}

function renderTable(rows) {
  const cols = ['engine', 'path', 'result', 'rows', 'console', 'failed req', 'title', 'final url', 'reason'];
  const cell = (r) => [r.engine, r.path, r.result, r.rows, r.console, r.failed, r.title, r.url, r.reason]
    .map((v) => String(v ?? '').replace(/\s+/g, ' ').slice(0, 110));
  const body = rows.map(cell);
  const widths = cols.map((c, i) => Math.max(c.length, ...body.map((b) => b[i].length)));
  const line = (vals) => vals.map((v, i) => v.padEnd(widths[i])).join(' | ').trimEnd();
  return [line(cols), widths.map((w) => '-'.repeat(w)).join('-+-'), ...body.map(line)].join('\n');
}

function selfTest() {
  assert.equal(parseBaseUrl(' https://test.projects.eao.gov.bc.ca/ '), 'https://test.projects.eao.gov.bc.ca');
  assert.throws(() => parseBaseUrl('ftp://x'));
  assert.throws(() => parseBaseUrl(''));
  assert.deepEqual(parsePaths('/, news\n /p/1/documents ,,\n'), ['/', '/news', '/p/1/documents']);
  assert.equal(parseBool('false', true), false);
  assert.equal(parseBool('', true), true);
  assert.equal(parseBool('TRUE', false), true);
  assert.equal(slug('safari', '/p/1/cp/2/details'), 'safari-p-1-cp-2-details');
  assert.equal(slug('webkit', '/'), 'webkit');
  const ok = { hasRoot: true, staticLoading: false, unavailable: false, gate: false };
  assert.equal(judge(ok), '');
  assert.match(judge({ ...ok, staticLoading: true }), /Loading/);
  assert.match(judge({ ...ok, unavailable: true }), /unavailable/);
  assert.match(judge({ ...ok, gate: true }), /gate/);
  assert.match(judge({ ...ok, hasRoot: false }), /app-root/);
  const t = renderTable([{ engine: 'safari', path: '/', result: 'PASS', rows: 3 }]).split('\n');
  assert.equal(t.length, 3);
  assert.match(t[0], /^engine +\| path/);
  assert.match(t[2], /^safari +\| \/ +\| PASS +\| 3/);
  console.log('self-test ok');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polls until the app shell replaced the static placeholder, then gives list pages time to fill.
// Tables render after the shell, so pages with no list always spend the full rows wait.
async function waitForApp(getState) {
  let state;
  const shellDeadline = Date.now() + SHELL_TIMEOUT_MS;
  while (Date.now() < shellDeadline) {
    state = await getState().catch(() => state);
    if (state && state.hasRoot && !state.staticLoading) break;
    await sleep(500);
  }
  const rowsDeadline = Date.now() + ROWS_TIMEOUT_MS;
  while (state && !judge(state) && state.rows === 0 && Date.now() < rowsDeadline) {
    await sleep(500);
    state = await getState().catch(() => state);
  }
  return state;
}

function pageRow(engine, path, state, extra = {}) {
  const reason = judge(state);
  return {
    engine, path, result: reason ? 'FAIL' : 'PASS', reason,
    rows: state?.tables ? state.rows : '-', title: state?.title, url: state?.url,
    console: 'n/a', failed: 'n/a', ...extra,
  };
}

// --- real Safari over W3C WebDriver (no client library needed) ---

async function wd(session, method, path, body) {
  const res = await fetch(`http://127.0.0.1:${DRIVER_PORT}/session${session ? `/${session}` : ''}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${json.value?.error}: ${json.value?.message}`.slice(0, 200));
  return json.value;
}

async function startSafariDriver() {
  const proc = spawn('safaridriver', ['-p', String(DRIVER_PORT)], { stdio: 'ignore' });
  proc.on('error', () => {});
  for (let i = 0; i < 40; i++) {
    try {
      const status = await (await fetch(`http://127.0.0.1:${DRIVER_PORT}/status`)).json();
      if (status.value?.ready !== undefined) return proc;
    } catch { /* not listening yet */ }
    await sleep(250);
  }
  proc.kill();
  throw new Error('safaridriver did not start; was `sudo safaridriver --enable` run?');
}

async function runSafari({ baseUrl, paths, gate, shotDir }) {
  const results = [];
  let proc;
  let session;
  try {
    proc = await startSafariDriver();
    const created = await wd(null, 'POST', '', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
    session = created.sessionId;
    console.log(`Safari ${created.capabilities.browserVersion}`);
    await wd(session, 'POST', '/timeouts', { pageLoad: 60_000, script: 30_000 });
    const getState = () => wd(session, 'POST', '/execute/sync', { script: PAGE_STATE, args: [] });
    if (gate) {
      // sessionStorage is per tab and origin, so seeding once before the real loads is enough.
      await wd(session, 'POST', '/url', { url: `${baseUrl}/` });
      await wd(session, 'POST', '/execute/sync', { script: "sessionStorage.setItem('eagle-gate','1')", args: [] });
    }
    for (const path of paths) {
      try {
        await wd(session, 'POST', '/url', { url: baseUrl + path });
        const state = await waitForApp(getState);
        const shot = await wd(session, 'GET', '/screenshot').catch(() => null);
        if (shot) writeFileSync(join(shotDir, `${slug('safari', path)}.png`), Buffer.from(shot, 'base64'));
        results.push(pageRow('safari', path, state, { console: 'not exposed', failed: 'not exposed' }));
      } catch (err) {
        results.push({ engine: 'safari', path, result: 'FAIL', reason: err.message });
      }
    }
    results.push(await safariPdf(session, baseUrl));
  } catch (err) {
    results.push({ engine: 'safari', path: '(session)', result: 'FAIL', reason: err.message });
  } finally {
    if (session) await wd(session, 'DELETE', '').catch(() => {});
    proc?.kill();
  }
  return results;
}

async function safariPdf(session, baseUrl) {
  const row = { engine: 'safari', path: `${PDF_PATH} (pdf)`, result: 'INFO', console: 'not exposed', failed: 'not exposed' };
  try {
    await wd(session, 'POST', '/url', { url: 'about:blank' });
    await wd(session, 'POST', '/url', { url: baseUrl + PDF_PATH }).catch((e) => { row.navError = e.message; });
    await sleep(3000);
    row.url = await wd(session, 'GET', '/url');
    const type = await wd(session, 'POST', '/execute/sync', { script: 'return document.contentType', args: [] })
      .catch(() => null);
    if (type === 'application/pdf') row.reason = 'stayed on a pdf view (document.contentType application/pdf)';
    else if (row.url === 'about:blank') row.reason = 'page did not leave about:blank: likely a download, not observable directly';
    else row.reason = `not observable (contentType ${type ?? 'unreadable'}${row.navError ? `, ${row.navError}` : ''})`;
  } catch (err) {
    row.reason = `not observable (${err.message})`;
  }
  return row;
}

// --- Playwright WebKit cross-check ---

async function runWebKit({ baseUrl, paths, gate, shotDir }) {
  const require = createRequire(join(process.env.PLAYWRIGHT_DIR || process.cwd(), 'node_modules', '.resolve'));
  const { webkit } = require('playwright');
  const browser = await webkit.launch();
  console.log(`WebKit ${browser.version()}`);
  const context = await browser.newContext({ acceptDownloads: true });
  if (gate) await context.addInitScript(() => sessionStorage.setItem('eagle-gate', '1'));
  const results = [];
  try {
    for (const path of paths) {
      const page = await context.newPage();
      const consoleErrors = [];
      const failed = [];
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
      page.on('pageerror', (e) => consoleErrors.push(e.message));
      page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));
      page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
      try {
        await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 60_000 });
        const state = await waitForApp(() => page.evaluate(`(() => {${PAGE_STATE}})()`));
        await page.screenshot({ path: join(shotDir, `${slug('webkit', path)}.png`), fullPage: true }).catch(() => {});
        results.push(pageRow('webkit', path, state, { console: consoleErrors.length, failed: failed.length }));
      } catch (err) {
        results.push({ engine: 'webkit', path, result: 'FAIL', reason: err.message.split('\n')[0] });
      }
      for (const line of [...consoleErrors.map((e) => `console: ${e}`), ...failed.map((f) => `request: ${f}`)]) {
        console.log(`  webkit ${path} ${line.slice(0, 300)}`);
      }
      await page.close();
    }
    results.push(await webkitPdf(context, baseUrl));
  } finally {
    await browser.close();
  }
  return results;
}

async function webkitPdf(context, baseUrl) {
  const row = { engine: 'webkit', path: `${PDF_PATH} (pdf)`, result: 'INFO', console: 'n/a', failed: 'n/a' };
  const page = await context.newPage();
  let downloaded = null;
  page.on('download', (d) => { downloaded = d.suggestedFilename(); });
  try {
    await page.goto(baseUrl + PDF_PATH, { timeout: 60_000 }).catch((e) => { row.navError = e.message.split('\n')[0]; });
    await sleep(3000);
    row.url = page.url();
    const type = await page.evaluate(() => document.contentType).catch(() => null);
    if (downloaded) row.reason = `download event (${downloaded})`;
    else if (type === 'application/pdf') row.reason = 'stayed on a pdf view (document.contentType application/pdf)';
    else row.reason = `not observable (contentType ${type ?? 'unreadable'}${row.navError ? `, ${row.navError}` : ''})`;
  } finally {
    await page.close();
  }
  return row;
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const baseUrl = parseBaseUrl(process.env.BASE_URL);
  const paths = parsePaths(process.env.PATHS);
  if (!paths.length) throw new Error('PATHS is empty');
  const gate = parseBool(process.env.GATE, true);
  const engines = parsePaths(process.env.ENGINES || 'safari,webkit').map((e) => e.slice(1));
  const shotDir = process.env.SHOT_DIR || 'safari-check-shots';
  mkdirSync(shotDir, { recursive: true });

  if (process.platform === 'darwin') console.log(execFileSync('sw_vers').toString().trim());
  console.log(`base ${baseUrl}, gate seed ${gate}, paths ${paths.join(' ')}`);

  const opts = { baseUrl, paths, gate, shotDir };
  const results = [];
  if (engines.includes('safari')) results.push(...await runSafari(opts));
  if (engines.includes('webkit')) {
    results.push(...await runWebKit(opts).catch((err) => [{ engine: 'webkit', path: '(launch)', result: 'FAIL', reason: err.message.split('\n')[0] }]));
  }

  const table = renderTable(results);
  console.log(`\n${table}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Safari check: ${baseUrl}\n\n\`\`\`\n${table}\n\`\`\`\n`);
  }
  const safariFailed = results.some((r) => r.engine === 'safari' && r.result === 'FAIL');
  if (safariFailed) {
    console.error('\nAt least one real-Safari row failed.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
