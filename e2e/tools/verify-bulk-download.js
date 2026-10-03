/* Checks the bulk-download UI on a running dev server: the document table's selection header bar
   and the transfer panel. Run `node tools/verify-bulk-download.js --help` for the usage. */
const { chromium } = require('playwright');

if (process.argv.includes('--help')) {
  console.log(`Usage: BASE_URL=http://localhost:4200 PROJECT_ID=<id> node tools/verify-bulk-download.js

Asserts, in a real browser, what jsdom cannot measure:
  - the header bar spans the table, sits on it, and keeps the grid at the same offset and itself at
    the same height with nothing, one row and the whole page selected, at 1920, 1400 and 390, on
    both the project documents tab and document search
  - Download and Clear still work from the bar
  - the document table carries no per-row download control and no clipped last column
  - the transfer panel neither pads the page nor covers the scroll-to-top button

demi-api's bulk-download endpoint is mocked, so nothing here spends the anonymous quota.
Writes /tmp/hdr-<width>-<state>.png. Prints one line per assertion; exits non-zero if any failed.`);
  process.exit(0);
}

const BASE = process.env.BASE_URL || 'http://localhost:4200';
const PROJECT_ID = process.env.PROJECT_ID || '588511a0aaecd9001b82316d';
const DOCS = `${BASE}/p/${PROJECT_ID}/documents`;
const SEARCH = `${BASE}/search?dataset=Document&keywords=water`;
const WIDTHS = [1920, 1400, 390];

const READY = {
  id: 'job-e2e',
  status: 'ready',
  partCount: 1,
  partsReady: 1,
  includedCount: 2,
  errorCount: 0,
  parts: [{ n: 1, fileName: 'documents.zip', url: `${BASE}/__fake-zip/documents.zip` }]
};

const results = [];
function check(name, ok, detail) {
  results.push({ ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Past the password curtain, with the job endpoint mocked and the first page of rows rendered. */
async function open(browser, url, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.addInitScript(() => localStorage.setItem('eagle-gate', '1'));
  await page.route(/bulk-downloads/, route => {
    const post = route.request().method() === 'POST';
    route.fulfill({
      status: post ? 202 : 200,
      contentType: 'application/json',
      body: JSON.stringify(post ? { id: 'job-e2e', status: 'running', partCount: 1 } : READY)
    });
  });
  // The ready panel fetches its parts; keep that off the network.
  await page.route('**/__fake-zip/*', route => route.fulfill({ status: 200, body: 'zip' }));
  // A cold Vite route can take a while to compile.
  page.setDefaultTimeout(60000);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.table-template .table tbody tr').first().waitFor();
  return page;
}

/** Document-relative, not viewport-relative: clicking a checkbox scrolls it into view. */
const gridTop = page =>
  page.evaluate(
    () => Math.round(document.querySelector('.table-template .table').getBoundingClientRect().top + window.scrollY)
  );
const barBox = page =>
  page.evaluate(() => {
    const bar = document.querySelector('.table-header-bar');
    const table = document.querySelector('.table-template .table');
    return bar
      ? {
          height: Math.round(bar.getBoundingClientRect().height),
          width: Math.round(bar.getBoundingClientRect().width),
          tableWidth: Math.round(table.getBoundingClientRect().width),
          gap: Math.round(table.getBoundingClientRect().top - bar.getBoundingClientRect().bottom)
        }
      : null;
  });

/** Every shot frames the bar itself: checking a row scrolls it wherever the row happens to be. */
async function shoot(page, width, state) {
  await page.locator('.table-header-bar').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/hdr-${width}-${state}.png` });
}

/** The bar holds the grid still through every selection state, and its controls work. */
async function headerBar(browser, label, url, width, shots) {
  const page = await open(browser, url, width);
  await page.locator('.table-header-bar').waitFor();

  const empty = await barBox(page);
  const topEmpty = await gridTop(page);
  check(
    `${label}: bar spans the table and sits on it`,
    empty.width === empty.tableWidth && empty.gap === 0,
    `bar ${empty.width} vs table ${empty.tableWidth}, gap ${empty.gap}`
  );
  if (shots) await shoot(page, width, 'empty');

  await page.locator('.table-template .table tbody input[type="checkbox"]').first().check();
  await page.getByText('1 selected').waitFor();
  const one = await barBox(page);
  const topOne = await gridTop(page);
  if (shots) await shoot(page, width, 'one');

  // The phone layout stacks the rows and hides the header row with them, so the whole page is
  // selected row by row there.
  const rows = page.locator('.table-template .table tbody input[type="checkbox"]');
  const headerCheckbox = page.locator('.table-template thead input[type="checkbox"]');
  const rowCount = await rows.count();
  if (await headerCheckbox.isVisible()) {
    await headerCheckbox.check();
  } else {
    for (let i = 0; i < rowCount; i++) await rows.nth(i).check();
  }
  await page.getByText(`${rowCount} selected`).waitFor();
  const all = await barBox(page);
  const topAll = await gridTop(page);
  if (shots) await shoot(page, width, 'all');

  check(
    `${label}: grid top unchanged by selecting`,
    topEmpty === topOne && topOne === topAll,
    `${topEmpty} / ${topOne} / ${topAll}`
  );
  check(
    `${label}: bar height unchanged by selecting`,
    empty.height === one.height && one.height === all.height,
    `${empty.height} / ${one.height} / ${all.height}`
  );
  check(`${label}: bar is one line at desktop widths`, width < 769 ? all.height <= 96 : all.height <= 56, `${all.height}px`);

  const download = page.getByRole('button', { name: 'Download', exact: true });
  check(`${label}: Download offered while rows are selected`, await download.isVisible());
  await page.getByRole('button', { name: 'Clear selection' }).click();
  const cleared = await page.locator('.table-header-bar').textContent();
  check(`${label}: Clear empties the selection`, !/ selected/.test(cleared), `bar reads "${cleared.trim()}"`);
  check(`${label}: bar returns to its resting height`, (await barBox(page)).height === empty.height);
  check(`${label}: grid top unchanged by clearing`, (await gridTop(page)) === topEmpty);

  await page.close();
}

/** The row keeps no download control of its own, and the panel stays out of the page's way. */
async function tableAndPanel(browser) {
  const page = await open(browser, DOCS, 1920);

  const downloadControls = await page
    .locator(
      '.table-template .download-col, .table-template .download-button, .table-template td[data-label="Download"], .table-template [aria-label^="Download "]'
    )
    .count();
  check('no download button in the table', downloadControls === 0, `${downloadControls} found`);

  const clip = await page.evaluate(() => {
    const table = document.querySelector('.table-template .table');
    const cells = table.querySelectorAll('tbody tr:first-child > *');
    const last = cells[cells.length - 1].getBoundingClientRect();
    return { last: last.right, table: table.getBoundingClientRect().right, columns: cells.length };
  });
  check(
    'last column right edge inside the table box',
    clip.last <= clip.table + 0.5,
    `cell right ${clip.last.toFixed(1)} vs table right ${clip.table.toFixed(1)}, ${clip.columns} columns`
  );

  await page.locator('.table-template .table tbody input[type="checkbox"]').first().check();
  await page.getByText('1 selected').waitFor();
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  await page.locator('.download-panel').waitFor();
  await page.waitForFunction(() => document.querySelector('.download-panel').textContent.includes('Downloaded'));

  const padding = await page.evaluate(() => document.body.style.paddingBottom);
  check('body has no paddingBottom while the panel shows', padding === '', `"${padding}"`);

  // The footer ends the document: no blank space under it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('.scroll-top-btn.visible') !== null);
  const bottom = await page.evaluate(() => ({
    footerBottom: Math.round(document.querySelector('footer').getBoundingClientRect().bottom + window.scrollY),
    scrollHeight: document.documentElement.scrollHeight
  }));
  check(
    'footer bottom equals documentElement.scrollHeight',
    Math.abs(bottom.footerBottom - bottom.scrollHeight) <= 1,
    `footer ${bottom.footerBottom} vs scrollHeight ${bottom.scrollHeight}`
  );

  const boxes = await page.evaluate(() => {
    const r = sel => {
      const { top, right, bottom, left } = document.querySelector(sel).getBoundingClientRect();
      return { top, right, bottom, left };
    };
    return { arrow: r('.scroll-top-btn'), panel: r('.download-panel') };
  });
  const overlap =
    boxes.arrow.left < boxes.panel.right &&
    boxes.arrow.right > boxes.panel.left &&
    boxes.arrow.top < boxes.panel.bottom &&
    boxes.arrow.bottom > boxes.panel.top;
  check(
    'scroll-to-top button does not intersect the panel',
    !overlap,
    `arrow top ${boxes.arrow.top.toFixed(1)}, panel bottom ${boxes.panel.bottom.toFixed(1)}`
  );

  await page.screenshot({ path: '/tmp/final-panel.png' });
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ chromiumSandbox: false, args: ['--no-sandbox'] });

  for (const width of WIDTHS) {
    await headerBar(browser, `documents @${width}`, DOCS, width, true);
    await headerBar(browser, `search @${width}`, SEARCH, width, false);
  }
  await tableAndPanel(browser);

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} assertions passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
