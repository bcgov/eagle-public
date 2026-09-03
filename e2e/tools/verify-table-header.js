/* Checks the document table header bar on a running dev server: the bar keeps the grid at the
   same document offset whether nothing, one row or the whole page is selected, at desktop,
   laptop and phone widths, on both the project documents tab and document search. Writes
   /tmp/hdr-<width>-<state>.png. Exits non-zero on any failure. */
const { chromium } = require('playwright');

if (process.argv.includes('--help')) {
  console.log('Usage: BASE_URL=http://localhost:4200 PROJECT_ID=<id> node tools/verify-table-header.js');
  process.exit(0);
}

const BASE = process.env.BASE_URL || 'http://localhost:4200';
const PROJECT_ID = process.env.PROJECT_ID || '588511a0aaecd9001b82316d';
const WIDTHS = [1920, 1400, 390];
const PAGES = [
  { name: 'documents', url: `${BASE}/p/${PROJECT_ID}/documents`, shots: true },
  { name: 'search', url: `${BASE}/search?dataset=Document&keywords=water`, shots: false }
];

const results = [];
function check(name, ok, detail) {
  results.push({ ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
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

(async () => {
  const browser = await chromium.launch({ chromiumSandbox: false, args: ['--no-sandbox'] });

  for (const target of PAGES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.addInitScript(() => sessionStorage.setItem('eagle-gate', '1'));
      // Nothing here starts a job; the route keeps a stray POST off demi-api all the same.
      await page.route('**/demi-search/bulk-downloads*', route =>
        route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'job-e2e', status: 'running', partCount: 1 }) })
      );

      const label = `${target.name} @${width}`;
      // A cold Vite route can take a while to compile; the bar renders only once rows exist.
      page.setDefaultTimeout(60000);
      await page.goto(target.url, { waitUntil: 'networkidle' });
      await page.locator('.table-header-bar').waitFor();
      await page.locator('.table-template .table tbody tr').first().waitFor();

      const empty = await barBox(page);
      const topEmpty = await gridTop(page);
      check(`${label}: bar spans the table and sits on it`, empty.width === empty.tableWidth && empty.gap === 0,
        `bar ${empty.width} vs table ${empty.tableWidth}, gap ${empty.gap}`);
      if (target.shots) await shoot(page, width, 'empty');

      await page.locator('.table-template .table tbody input[type="checkbox"]').first().check();
      await page.getByText('1 selected').waitFor();
      const one = await barBox(page);
      const topOne = await gridTop(page);
      if (target.shots) await shoot(page, width, 'one');

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
      if (target.shots) await shoot(page, width, 'all');

      check(`${label}: grid top unchanged by selecting`, topEmpty === topOne && topOne === topAll,
        `${topEmpty} / ${topOne} / ${topAll}`);
      check(`${label}: bar height unchanged by selecting`, empty.height === one.height && one.height === all.height,
        `${empty.height} / ${one.height} / ${all.height}`);
      check(`${label}: bar is one line at desktop widths`, width < 769 ? all.height <= 96 : all.height <= 56,
        `${all.height}px`);

      // The controls the bar owns still work.
      const download = page.getByRole('button', { name: 'Download' });
      check(`${label}: Download offered while rows are selected`, await download.isVisible());
      await page.getByRole('button', { name: 'Clear selection' }).click();
      const cleared = await page.locator('.table-header-bar').textContent();
      check(`${label}: Clear empties the selection`, !/ selected/.test(cleared), `bar reads "${cleared.trim()}"`);
      check(`${label}: bar returns to its resting height`, (await barBox(page)).height === empty.height);
      check(`${label}: grid top unchanged by clearing`, (await gridTop(page)) === topEmpty);

      await page.close();
    }
  }

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} assertions passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
