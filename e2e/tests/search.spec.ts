import activities from '../fixtures/unified-search/activities.json';
import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { test, expect, type Page } from '../support/fixtures';
import {
  checkBaseline,
  gridCount,
  ready,
  recordApiCalls,
  total,
  waitForSearch,
} from '../support/helpers';

/**
 * The one search page at /search: the keyword field, the record-type pills, and the display grid
 * the chosen record type configures.
 *
 * Most tests answer every backend read from `e2e/fixtures/unified-search`, the same rows the parity
 * gate uses, so a count or a row order is an assertion rather than whatever the environment holds
 * today. The first test is the exception: it runs against the real backend, because the calls the
 * page makes are the thing it pins. Legacy /projects-list and Angular /search links live in
 * `routing.spec.ts`.
 */

const ROWS = '.display-grid__row';
/** The body of the update the activities list opens on, long enough to be cut to an excerpt. */
const LONG_UPDATE = activities.find((update) => update._id === 'u1')?.content ?? '';
/** The first data cell of a row. A selectable table puts its checkbox cell ahead of it. */
const NAME = 'td.display-grid__cell:not(.display-grid__cell--select)';

/** Fixture-backed page: deterministic rows, and nothing leaves the box. */
async function openSearch(page: Page, url = '/search'): Promise<void> {
  await routeDemiSearch(page);
  await page.goto(url);
  await page.locator('.display-grid').waitFor({ state: 'visible' });
}

function pill(page: Page, label: string) {
  return page.locator('[data-tour="types"] button').filter({ hasText: label });
}

function keywordField(page: Page) {
  return page.getByPlaceholder('Search projects, documents and updates');
}

test('the projects tab lists projects from the search API', async ({ page }) => {
  const calls = recordApiCalls(page);
  const search = waitForSearch(page, 'Project');
  await page.goto('/search?record=projects');
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  for (const column of ['Project', 'Proponent', 'Type', 'Region', 'Phase']) {
    await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  }
  // Last updated starts switched off, so the tab opens on what a project is rather than its date.
  await expect(page.getByRole('columnheader', { name: 'Last updated', exact: true })).toHaveCount(
    0,
  );

  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(Math.min(25, total(env)));
  await expect(rows.first().locator(NAME).first()).toHaveText(env.searchResults[0].name);
  expect((await gridCount(page)).total).toBe(total(env));

  checkBaseline('search', calls);
});

/** A colour as its sRGB channels, whatever notation the browser reports it in. */
function channels(colour: string): number[] {
  const numbers = colour.match(/[\d.]+/g)?.map(Number) ?? [];
  return colour.startsWith('color(')
    ? numbers.slice(0, 3)
    : numbers.slice(0, 3).map((n) => n / 255);
}

/** Rough lightness, enough to say one fill is a step towards white from another. */
function lightness(colour: string): number {
  const [r, g, b] = channels(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('the chosen record pill is a white chip, and hover lifts the fill of the others', async ({
  page,
}) => {
  await openSearch(page, '/search?record=projects');

  const bandBlue = await page
    .locator('.page-masthead')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const style = (label: string) =>
    pill(page, label).evaluate((el) => {
      const computed = getComputedStyle(el);
      return { colour: computed.color, background: computed.backgroundColor };
    });

  // Chosen: the band's blue on white, the reverse of the band's own ink.
  expect(await style('Projects')).toEqual({ colour: bandBlue, background: 'rgb(255, 255, 255)' });
  // The rest carry no fill at all, so the band shows through.
  expect((await style('Documents')).background).toBe('rgba(0, 0, 0, 0)');

  await pill(page, 'Documents').hover();
  const hovered = await style('Documents');
  expect(hovered.colour).toBe('rgb(255, 255, 255)');
  expect(hovered.background, 'the hover fill is not the bare band').not.toBe(bandBlue);
  expect(
    lightness(hovered.background),
    'the hover fill is the band blue a step towards white',
  ).toBeGreaterThan(lightness(bandBlue));
});

test('a table row takes no hover tint or pointer, because only its link opens anything', async ({
  page,
}) => {
  await openSearch(page, '/search?record=projects');
  const row = page.locator(`tbody ${ROWS}`).first();
  const style = () =>
    row.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, cursor: computed.cursor };
    });
  const resting = await style();

  // The last cell, not the name: hovering the link itself would say nothing about the row.
  await row.locator('td').last().hover();
  expect(await style()).toEqual(resting);
  expect(resting.cursor).toBe('auto');
});

test('every record pill carries its own count for the typed keyword', async ({ page }) => {
  await openSearch(page);
  await keywordField(page).fill('mine');

  await expect(pill(page, 'Projects').locator('.unified-search__pill-count')).toHaveText('4');
  await expect(pill(page, 'Documents').locator('.unified-search__pill-count')).toHaveText('0');
  await expect(
    pill(page, 'Activities & updates').locator('.unified-search__pill-count'),
  ).toHaveText('1');
  await expect(
    pill(page, 'Project notifications').locator('.unified-search__pill-count'),
  ).toHaveText('2');
});

test('a keyword narrows the rows and lands in the URL', async ({ page }) => {
  await openSearch(page, '/search?record=projects');
  await keywordField(page).fill('coal');

  await expect(page.locator(ROWS)).toHaveCount(1);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Sukunka Coal');
  await expect(page).toHaveURL(/[?&]keywords=coal(&|$)/);
  expect(await gridCount(page)).toEqual({ first: 1, last: 1, total: 1 });
});

test('the projects tab opens in name order, and the header reverses it', async ({ page }) => {
  await openSearch(page, '/search?record=projects');
  const header = page.getByRole('columnheader', { name: 'Project', exact: true });
  const firstName = page.locator(ROWS).first().locator(NAME).first();

  // The tab's own sort, with nothing on the address to say so.
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(new URL(page.url()).searchParams.get('sortBy')).toBeNull();
  await expect(firstName).toHaveText('7 Mile Renewable Fuels Production Facility');

  await header.getByRole('button').click();
  // The URL settles first; reading aria-sort before it would find the pre-click value.
  await expect.poll(() => new URL(page.url()).searchParams.get('sortBy')).toBe('-name');
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await expect(firstName).toHaveText('Willow Creek Wind');

  await header.getByRole('button').click();
  // `+name` goes on the wire unencoded, so a URL parser reads it back as " name".
  await expect.poll(() => new URL(page.url()).searchParams.get('sortBy')).toMatch(/^[+ ]name$/);
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await expect(firstName).toHaveText('7 Mile Renewable Fuels Production Facility');
});

test('a deep link restores the keyword, the sort and the page size', async ({ page }) => {
  await openSearch(page, '/search?record=projects&keywords=mine&sortBy=-name&pageSize=10');

  await expect(keywordField(page)).toHaveValue('mine');
  await expect(page.locator(ROWS)).toHaveCount(4);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Sukunka Coal');
  expect(await gridCount(page)).toEqual({ first: 1, last: 4, total: 4 });
});

test('pagination moves to the second page and records it in the URL', async ({ page }) => {
  await openSearch(page, '/search?record=projects&pageSize=10');
  await expect(page.locator(ROWS)).toHaveCount(10);

  await page.getByRole('button', { name: 'Go to page 2' }).first().click();

  expect(new URL(page.url()).searchParams.get('currentPage')).toBe('2');
  await expect(page.locator(ROWS)).toHaveCount(2);
  // 11th of the 12 fixture projects in name order, which is what the tab lists by.
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText(
    'Vancouver Island Waste-to-Energy',
  );
  expect(await gridCount(page)).toEqual({ first: 11, last: 12, total: 12 });
});

test('a filter in the header row narrows the rows to that value', async ({ page }) => {
  await openSearch(page, '/search?record=projects');
  await page.locator('[data-tour="filterrow"] button[aria-label="Filter by Region"]').click();
  await page.getByRole('group', { name: 'Filter by Region' }).getByText('Skeena').click();

  expect(new URL(page.url()).searchParams.get('region')).toBe('Skeena');
  await expect(page.locator(ROWS)).toHaveCount(5);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText('Cedar LNG');
});

test('copy link puts the address of the current view on the clipboard', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openSearch(page, '/search?keywords=mine&sortBy=-name');
  const copy = page.locator('[data-tour="copy"]');

  await copy.click();

  // The button carries a Material Icons ligature next to its label, so the label is a substring.
  await expect(copy).toContainText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test('the documents pill switches the grid to the document columns', async ({ page }) => {
  await openSearch(page);
  await pill(page, 'Documents').click();

  expect(new URL(page.url()).searchParams.get('record')).toBe('documents');
  for (const column of [
    'Name',
    'Date posted',
    'Document type',
    'Milestone',
    'Project phase',
    'Author',
  ]) {
    await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  }
  await expect(page.locator(ROWS)).toHaveCount(18);
  await expect(page.locator(ROWS).first().locator(NAME).first()).toHaveText(
    'Amendment #3 Application — Volume 1',
  );
});

test('the activities pill lists updates as full-width rows', async ({ page }) => {
  await openSearch(page);
  await pill(page, 'Activities & updates').click();

  expect(new URL(page.url()).searchParams.get('record')).toBe('activities');
  // A list has no column headings, and nothing to hide, so no column picker either.
  await expect(page.getByRole('columnheader')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Columns shown' })).toHaveCount(0);

  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(10);
  // Newest first, which for an update is `dateAdded`.
  const first = rows.first();
  await expect(first.getByRole('heading', { level: 3 })).toHaveText(
    'Amendment #3 application accepted for review',
  );
  await expect(first.getByRole('link', { name: 'Cedar LNG' })).toHaveAttribute('href', '/p/p1');
  await expect(
    first.getByRole('link', { name: 'Amendment #3 Application — Volume 1.pdf' }),
  ).toBeVisible();

  // Full width in earnest: the reading measure the other templates keep is lifted for these rows,
  // which stack their parts and put nothing beside them.
  const size = await first.evaluate((row) => {
    const body = row.querySelector('.display-grid__row-body') as HTMLElement;
    return {
      row: row.getBoundingClientRect().width,
      body: body.getBoundingClientRect().width,
      cap: getComputedStyle(body).maxWidth,
    };
  });
  expect(size.cap).toBe('none');
  expect(size.body).toBeGreaterThan(size.row * 0.9);
});

test('a long update is cut to an excerpt until Show more opens it', async ({ page }) => {
  await openSearch(page, '/search?record=activities');
  const first = page.locator(ROWS).first();
  const body = first.locator('.display-grid__row-body');

  // The cut is by character rather than by line, so the row says the same thing at every width.
  const excerpt = (await body.innerText()).trim();
  expect(excerpt).toMatch(/…$/);
  expect(excerpt.length).toBeLessThan(LONG_UPDATE.length);
  expect(
    LONG_UPDATE.startsWith(excerpt.slice(0, -1)),
    'the excerpt is the head of the update',
  ).toBe(true);

  await first.getByRole('button', { name: 'Show more' }).click();

  await expect(body).toHaveText(LONG_UPDATE);
  await expect(first.getByRole('button', { name: 'Show less' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await first.getByRole('button', { name: 'Show less' }).click();

  await expect(body).toHaveText(excerpt);
  await expect(first.getByRole('button', { name: 'Show more' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('the attachments filter keeps only the updates that carry a document', async ({ page }) => {
  await openSearch(page, '/search?record=activities');
  await expect(page.locator(ROWS)).toHaveCount(10);

  await page.getByRole('button', { name: /More filters/ }).click();
  const attached = page.getByRole('checkbox', { name: 'Documents attached' });
  /* `click`, not `check`: the box is controlled by the URL, which is written a tick after the
     click, so `check`'s own read of the state lands in between. */
  await attached.click();

  await expect(attached).toBeChecked();
  expect(new URL(page.url()).searchParams.get('documentUrl')).toBe('true');
  await expect(page.locator(ROWS)).toHaveCount(9);
});

test('the notifications pill draws one card per notification', async ({ page }) => {
  await openSearch(page);
  await pill(page, 'Project notifications').click();

  expect(new URL(page.url()).searchParams.get('record')).toBe('notifications');
  await expect(page.locator(ROWS)).toHaveCount(8);
  const first = page.locator(ROWS).first();
  // The card names the notification in its open Details tab; the other tab panels stay hidden.
  await expect(first.getByRole('heading', { level: 3 })).toHaveText('SKEENA MODULAR HOUSING WORKS');
  await expect(first.getByRole('tab', { name: 'Documents' })).toBeVisible();
});

test('a notification filter lives in the panel, because a card has no filter row', async ({
  page,
}) => {
  await openSearch(page, '/search?record=notifications');
  await expect(page.getByRole('columnheader')).toHaveCount(0);

  await page.getByRole('button', { name: /More filters/ }).click();
  await page.getByLabel('Notification decision').selectOption('In Progress');

  expect(new URL(page.url()).searchParams.get('decision')).toBe('In Progress');
  await expect(page.locator(ROWS)).toHaveCount(4);
  expect((await gridCount(page)).total).toBe(4);
});

test('selecting a document offers it for download', async ({ page }) => {
  await openSearch(page, '/search?record=documents');
  const firstRow = page.locator(ROWS).first();
  await expect(firstRow.locator(NAME).first()).toHaveText('Amendment #3 Application — Volume 1');

  await firstRow.getByRole('checkbox').check();

  await expect(page.locator('.display-grid__count')).toHaveText('1 selected');
  await expect(page.getByRole('button', { name: 'Download 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  expect(await gridCount(page)).toEqual({ first: 1, last: 18, total: 18 });
});

function helpLink(page: Page) {
  return page.getByRole('link', { name: 'Search help' });
}

test('search help opens over the results and Escape gives the page back', async ({ page }) => {
  await openSearch(page);
  await helpLink(page).click();

  const help = page.getByRole('dialog', { name: 'Search help' });
  await expect(help.getByRole('heading', { name: 'Quotes' })).toBeVisible();
  await expect(help.getByRole('heading', { name: 'Hyphens' })).toBeVisible();
  // The long-form page keeps the folder-structure lists this summary does not repeat.
  await expect(help.getByRole('link', { name: 'Advanced search help' })).toHaveAttribute(
    'href',
    '/search-help',
  );

  await page.keyboard.press('Escape');

  await expect(help).toBeHidden();
  await expect(helpLink(page)).toBeFocused();
});

test('the tour recounts when a narrow layout drops a control', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openSearch(page);
  await helpLink(page).click();
  await page.getByRole('button', { name: 'Take the tour' }).click();

  const card = page.getByRole('dialog');
  for (const _step of [1, 2, 3, 4]) {
    await card.getByRole('button', { name: 'Next' }).click();
  }
  await expect(card.getByText('Step 5 of 7', { exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Filters that are not columns' })).toBeVisible();

  // Below 720px the column filter row is not rendered at all, so the walk is one step shorter.
  await page.setViewportSize({ width: 500, height: 900 });

  await expect(page.locator('[data-tour="filterrow"]')).toHaveCount(0);
  await expect(card.getByText('Step 4 of 6', { exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Filters that are not columns' })).toBeVisible();

  await card.getByRole('button', { name: 'Next' }).click();

  await expect(card.getByText('Step 5 of 6', { exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Choose your columns' })).toBeVisible();
});

test('the tour walks every control from the keyboard', async ({ page }) => {
  await openSearch(page);
  await helpLink(page).click();
  await page.getByRole('button', { name: 'Take the tour' }).click();

  const card = page.getByRole('dialog', { name: 'One search box' });
  await expect(card).toBeVisible();

  // Each step lands focus on the card, and Shift+Tab out of it wraps to the last control in it,
  // which is Next. Seven steps, so Next is pressed six times.
  for (const step of [1, 2, 3, 4, 5, 6]) {
    const open = page.getByRole('dialog');
    // Exact: the card's own count and the announcement beside it both open with this text.
    await expect(open.getByText(`Step ${step} of 7`, { exact: true })).toBeVisible();
    await expect(open).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(open.getByRole('button', { name: 'Next' })).toBeFocused();
    await page.keyboard.press('Enter');
  }

  const last = page.getByRole('dialog');
  await expect(last.getByText('Step 7 of 7', { exact: true })).toBeVisible();
  await expect(last.getByRole('button', { name: 'Done' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(helpLink(page)).toBeFocused();
});
