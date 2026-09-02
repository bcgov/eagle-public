/* Checks a running dev server: no per-row Download column in the document table, and the transfer
   panel neither pads the page nor covers the scroll-to-top button. Exits non-zero on any failure. */
const { chromium } = require('playwright');

if (process.argv.includes('--help')) {
  console.log('Usage: BASE_URL=http://localhost:4200 PROJECT_ID=<id> node tools/verify-download-ux.js');
  process.exit(0);
}

const BASE = process.env.BASE_URL || 'http://localhost:4200';
const PROJECT_ID = process.env.PROJECT_ID || '588511a0aaecd9001b82316d';
const DOCS = `${BASE}/p/${PROJECT_ID}/documents`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
  const browser = await chromium.launch({ chromiumSandbox: false, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript(() => sessionStorage.setItem('eagle-gate', '1'));

  const READY = {
    id: 'job-e2e',
    status: 'ready',
    partCount: 1,
    partsReady: 1,
    includedCount: 2,
    errorCount: 0,
    parts: [{ n: 1, fileName: 'documents.zip', url: `${BASE}/__fake-zip/documents.zip` }]
  };

  await page.route(/bulk-downloads/, route => {
    const body = route.request().method() === 'POST' ? { id: 'job-e2e', status: 'running', partCount: 1 } : READY;
    route.fulfill({
      status: route.request().method() === 'POST' ? 202 : 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
  // The ready panel fetches its parts; keep that off the network.
  await page.route('**/__fake-zip/*', route => route.fulfill({ status: 200, body: 'zip' }));

  await page.goto(DOCS, { waitUntil: 'networkidle' });
  await page.locator('.table-template .table tbody tr').first().waitFor();

  // 1. No per-row download control anywhere in the document table.
  const downloadControls = await page
    .locator('.table-template .download-col, .table-template .download-button, .table-template td[data-label="Download"], .table-template [aria-label^="Download "]')
    .count();
  check('no download button in the table', downloadControls === 0, `${downloadControls} found`);

  // 2. The last column is not clipped: its right edge sits inside the table's box.
  const clip = await page.evaluate(() => {
    const table = document.querySelector('.table-template .table');
    const cells = table.querySelectorAll('tbody tr:first-child > *');
    const last = cells[cells.length - 1].getBoundingClientRect();
    const box = table.getBoundingClientRect();
    return { last: last.right, table: box.right, columns: cells.length };
  });
  check(
    'last column right edge inside the table box',
    clip.last <= clip.table + 0.5,
    `cell right ${clip.last.toFixed(1)} vs table right ${clip.table.toFixed(1)}, ${clip.columns} columns`
  );

  await page.screenshot({ path: '/tmp/final-docs.png', fullPage: true });

  // Open the panel through the real flow: select a row, then Download in the toolbar.
  await page.locator('.table-template .table tbody input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  await page.locator('.download-panel').waitFor();
  await page.waitForFunction(() => document.querySelector('.download-panel').textContent.includes('Downloaded'));

  // 3. Nothing pads the body while the panel shows.
  const padding = await page.evaluate(() => document.body.style.paddingBottom);
  check('body has no paddingBottom while the panel shows', padding === '', `"${padding}"`);

  // 4. The footer ends the document: no blank space under it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('.scroll-top-btn.visible') !== null);
  const bottom = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const rect = footer.getBoundingClientRect();
    return {
      footerBottom: Math.round(rect.bottom + window.scrollY),
      scrollHeight: document.documentElement.scrollHeight
    };
  });
  check(
    'footer bottom equals documentElement.scrollHeight',
    Math.abs(bottom.footerBottom - bottom.scrollHeight) <= 1,
    `footer ${bottom.footerBottom} vs scrollHeight ${bottom.scrollHeight}`
  );

  // 5. The scroll-to-top button and the panel do not overlap.
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

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} assertions passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
