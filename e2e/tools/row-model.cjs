/**
 * Proves the document row interaction model against the running dev server.
 *
 *   node tools/row-model.cjs [baseUrl]
 *
 * Bulk-download POSTs are mocked: this box's anonymous quota at demi-api is spent, and the point
 * here is which control fires a download, not what the zip contains.
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4200';
const PROJECT_DOCS = '/p/588511a0aaecd9001b82316d/documents';
const SEARCH_DOCS = '/search?dataset=Document&keywords=water';

const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ pass, name, actual, expected });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

async function main() {
  const browser = await chromium.launch({ chromiumSandbox: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addInitScript(() => sessionStorage.setItem('eagle-gate', '1'));

  let posts = [];
  await context.route('**/bulk-downloads*', async (route, request) => {
    if (request.method() === 'POST') {
      posts.push(JSON.parse(request.postData() || '{}'));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ single: true, url: 'https://nrs.example/one.pdf' })
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const page = await context.newPage();

  async function openTable(path) {
    await page.goto(BASE + path, { waitUntil: 'commit' });
    await page.waitForSelector('table tbody tr td[data-label="Name"] a', { timeout: 30000 });
    await page.waitForTimeout(500);
    posts = [];
  }

  async function runTable(label, path) {
    await openTable(path);
    const row = page.locator('table tbody tr').first();
    const checkbox = row.locator('input[type="checkbox"]');
    const name = row.locator('td[data-label="Name"] a');

    // 1. a click on a metadata cell selects the row and downloads nothing
    await row.locator('td[data-label="Date"]').click();
    check(`${label}: date cell checks the row's checkbox`, await checkbox.isChecked(), true);
    check(`${label}: date cell posts no download`, posts.length, 0);
    check(`${label}: selected row is tinted`, await row.getAttribute('class'), 'selectable-row selected');

    // 2. clicking it again releases the selection
    await row.locator('td[data-label="Date"]').click();
    check(`${label}: second click clears the selection`, await checkbox.isChecked(), false);
    check(`${label}: second click posts no download`, posts.length, 0);

    // 3. the name link downloads one document
    await name.click();
    await page.waitForTimeout(600);
    check(`${label}: name link posts one document`, posts.length, 1);
    check(`${label}: name link posts a single id`, posts[0]?.documentIds?.length, 1);
    check(`${label}: name link leaves the row unselected`, await checkbox.isChecked(), false);

    // 4. the row download button downloads one document
    posts = [];
    await row.locator('td[data-label="Download"] button').click();
    await page.waitForTimeout(600);
    check(`${label}: download button posts one document`, posts.length, 1);
    check(`${label}: download button leaves the row unselected`, await checkbox.isChecked(), false);

    // 5. Space on the focused row selects; Enter downloads
    posts = [];
    await row.focus();
    await page.keyboard.press(' ');
    check(`${label}: Space on the row selects it`, await checkbox.isChecked(), true);
    check(`${label}: Space posts no download`, posts.length, 0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    check(`${label}: Enter on the row downloads`, posts.length, 1);
    check(`${label}: Enter keeps the selection`, await checkbox.isChecked(), true);

    // 6. the header checkbox selects the whole page
    const rows = await page.locator('table tbody tr').count();
    await page.locator('thead input[type="checkbox"]').check();
    check(
      `${label}: header checkbox selects every row on the page`,
      await page.locator('table tbody tr.selected').count(),
      rows
    );
    await page.locator('button:has-text("Clear")').click();
    check(`${label}: Clear empties the selection`, await page.locator('table tbody tr.selected').count(), 0);
  }

  await runTable('project documents', PROJECT_DOCS);
  await runTable('search results', SEARCH_DOCS);

  // Screenshots: hover, selected and focused rows, desktop and phone.
  async function shots(width, height, tag) {
    await page.setViewportSize({ width, height });
    await openTable(PROJECT_DOCS);
    const row = page.locator('table tbody tr').first();

    await row.locator('td[data-label="Date"]').hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/rows-${tag}-hover.png` });

    await row.locator('td[data-label="Date"]').click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/rows-${tag}-selected.png` });

    await row.locator('td[data-label="Date"]').click();
    await row.focus();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/rows-${tag}-focused.png` });

    await page.locator('table tbody tr').nth(1).locator('td[data-label="Date"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/rows-${tag}-toolbar.png` });
  }

  await shots(1400, 900, '1400');
  await shots(390, 844, '390');

  await browser.close();

  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
