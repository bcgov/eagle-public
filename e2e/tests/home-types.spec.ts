import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '../support/fixtures';

/**
 * The Home "Projects by type" band: type level, sub-type level, the project table, and the
 * address that carries the level so Back walks up it. Live data, so the rows are read off the page
 * rather than named here.
 */

/** A bar row's accessible name: `Mines, 42 projects. Show sub-types`. */
const ROW_LABEL = /^(.+), (\d+) projects?\. Show (sub-types|projects)$/;

// The band reads every public project in one call; the test API can take a while on a cold start.
const DATA_TIMEOUT = 60_000;

function band(page: Page): Locator {
  return page.getByRole('region', { name: 'Projects by type' });
}

function barLinks(page: Page): Locator {
  return band(page).locator('.home-types__bars').getByRole('link');
}

function currentCrumb(page: Page): Locator {
  return band(page)
    .getByRole('navigation', { name: 'Chart level' })
    .locator('[aria-current="location"]');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Name and count from a bar row's accessible name. */
async function readRow(link: Locator): Promise<{ name: string; count: number }> {
  const label = (await link.getAttribute('aria-label')) ?? '';
  const match = ROW_LABEL.exec(label);
  expect(match, `bar row label "${label}"`).not.toBeNull();
  return { name: match![1], count: Number(match![2]) };
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  // The band reads nothing until it nears the viewport.
  await band(page).scrollIntoViewIfNeeded();
  await expect(barLinks(page).first()).toBeVisible({ timeout: DATA_TIMEOUT });
}

/** Clicks the first type that opens a sub-type level (a type with one sub-type skips straight to its projects). */
async function openType(page: Page): Promise<{ name: string; count: number }> {
  const row = band(page)
    .locator('.home-types__bars')
    .getByRole('link', { name: /Show sub-types$/ })
    .first();
  const picked = await readRow(row);
  await row.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('type') === picked.name);
  return picked;
}

/** Clicks the first sub-type row at the current type level. */
async function openSubType(page: Page): Promise<{ name: string; count: number }> {
  const row = barLinks(page).first();
  await expect(row).toHaveAccessibleName(/Show projects$/);
  const picked = await readRow(row);
  await row.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('subType') === picked.name);
  return picked;
}

test('the band renders its heading, type rows and the total count', async ({ page }) => {
  await openHome(page);

  await expect(band(page).getByRole('heading', { level: 2 })).toHaveText('Projects by type');
  await expect(barLinks(page)).not.toHaveCount(0);
  await expect(band(page).locator('.home-types__count')).toHaveText(/^[1-9]\d* projects$/);
  await expect(currentCrumb(page)).toHaveText('All types');
});

test('choosing a type puts it in the address, the trail and focus', async ({ page }) => {
  await openHome(page);
  const type = await openType(page);

  await expect(band(page).getByRole('navigation', { name: 'Chart level' })).toHaveText(
    new RegExp(`^All types\\s*›\\s*${escapeRe(type.name)}$`),
  );
  await expect(currentCrumb(page)).toHaveText(type.name);
  await expect(currentCrumb(page)).toBeFocused();
  await expect(band(page).locator('.home-types__count')).toHaveText(`${type.count} projects`);
  // The rows are now this type's sub-types, each opening its projects.
  await expect(barLinks(page).first()).toHaveAccessibleName(/Show projects$/);
});

test('choosing a sub-type shows its project table and hides the treemap', async ({ page }) => {
  await openHome(page);
  const type = await openType(page);
  const sub = await openSubType(page);

  const table = band(page).getByRole('table', { name: `${sub.name} projects` });
  await expect(table.getByRole('columnheader')).toHaveText(['Project', 'Region', 'Phase']);
  await expect(table.locator('tbody tr')).toHaveCount(sub.count);
  await expect(table.locator('a[href^="/p/"]').first()).toBeVisible();
  await expect(band(page).getByRole('navigation', { name: 'Chart level' })).toHaveText(
    new RegExp(`^All types\\s*›\\s*${escapeRe(type.name)}\\s*›\\s*${escapeRe(sub.name)}$`),
  );
  await expect(currentCrumb(page)).toBeFocused();

  const map = band(page).locator('.home-types__map');
  await expect(map).toHaveAttribute('aria-hidden', 'true');
  await expect(map).toHaveAttribute('inert', '');
});

test('Back steps up one level at a time', async ({ page }) => {
  await openHome(page);
  const type = await openType(page);
  await openSubType(page);
  await expect(band(page).getByRole('table')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('type') === type.name && !url.searchParams.has('subType'),
  );
  await expect(currentCrumb(page)).toHaveText(type.name);
  await expect(band(page).getByRole('table')).toHaveCount(0);
  await expect(barLinks(page).first()).toHaveAccessibleName(/Show projects$/);

  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === '/' && !url.searchParams.has('type'));
  await expect(currentCrumb(page)).toHaveText('All types');
  await expect(band(page).locator('.home-types__map')).not.toHaveAttribute('inert', '');
});

test.describe('at 375px wide', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // html and body set `overflow-x: clip`, so the page itself can never scroll sideways and
  // `scrollWidth` always equals the viewport. Too-wide content is cut off instead, so measure how
  // far the band's furthest box reaches past the right edge. The treemap zooms by scaling its
  // tiles past its own box and clips them there, so its box counts but its tiles do not.
  const overflowX = (page: Page) =>
    band(page).evaluate((root) => {
      let right = 0;
      for (const el of root.querySelectorAll('*:not(.home-types__map *)')) {
        const box = el.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) right = Math.max(right, box.right);
      }
      return Math.max(0, Math.round(right) - document.documentElement.clientWidth);
    });

  test('no level reaches past the right edge', async ({ page }) => {
    await openHome(page);
    await expect.poll(() => overflowX(page)).toBe(0);

    await openType(page);
    await expect.poll(() => overflowX(page)).toBe(0);

    await openSubType(page);
    await expect(band(page).getByRole('table')).toBeVisible();
    await expect.poll(() => overflowX(page)).toBe(0);
  });
});
