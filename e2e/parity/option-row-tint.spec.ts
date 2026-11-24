// Option rows in the /search Columns menu and filter popovers: tint on hover, focus and checked,
// none on a locked row. CSS-only, so only a real browser sees it.
import { expect, type Page } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { test, VIEWPORT } from './capture';
import { OPTION_ROW } from './tokens';

const ROW = '.display-grid__option';
const UNTINTED = 'rgba(0, 0, 0, 0)';

async function openSearch(page: Page) {
  await routeDemiSearch(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto('/search', { waitUntil: 'networkidle' });
}

async function openColumns(page: Page) {
  await openSearch(page);
  await page.getByRole('button', { name: 'Columns', exact: true }).click();
  return page.getByRole('group', { name: 'Columns shown' });
}

async function openDocumentTypes(page: Page) {
  await openSearch(page);
  await page.getByRole('button', { name: 'Filter by Document type' }).click();
  return page.getByRole('group', { name: 'Filter by Document type' });
}

test('Columns menu: a row tints on hover', async ({ page }) => {
  const menu = await openColumns(page);
  const row = menu.locator(`${ROW}:has(input:enabled)`).first();

  await row.hover();

  await expect(row, OPTION_ROW.hover.token).toHaveCSS('background-color', OPTION_ROW.hover.value);
});

test('Columns menu: keyboard focus on a checkbox tints its row', async ({ page }) => {
  const menu = await openColumns(page);
  const checkbox = menu.locator('input:enabled').first();
  // Focus stays on the Columns button after the click; Tab moves past the locked checkbox.
  await page.keyboard.press('Tab');
  await expect(checkbox).toBeFocused();

  await expect(menu.locator(`${ROW}:has(input:focus)`), OPTION_ROW.hover.token).toHaveCSS(
    'background-color',
    OPTION_ROW.hover.value,
  );
});

test('Columns menu: the locked row takes no tint on hover', async ({ page }) => {
  const menu = await openColumns(page);
  const row = menu.locator(`${ROW}:has(input:disabled)`);

  await row.hover();

  await expect(row).toHaveCSS('background-color', UNTINTED);
  await expect(row).toHaveCSS('cursor', 'not-allowed');
});

test('Columns menu: checkboxes line up with the menu title', async ({ page }) => {
  const menu = await openColumns(page);
  const title = await menu.locator('.display-grid__menu-title').boundingBox();
  const checkbox = await menu.locator(`${ROW} input`).first().boundingBox();

  expect(checkbox?.x).toBe(title?.x);
});

test('filter popover: an unchecked value tints on hover', async ({ page }) => {
  const picker = await openDocumentTypes(page);
  const row = picker.locator(ROW).first();

  await row.hover();

  await expect(row, OPTION_ROW.hover.token).toHaveCSS('background-color', OPTION_ROW.hover.value);
});

/** The checkbox is controlled by the URL, so it flips after the filter round trip, not on click. */
async function checkFirstDocumentType(page: Page) {
  const picker = await openDocumentTypes(page);
  const row = picker.locator(ROW).first();
  await row.locator('input').click();
  await expect(row.locator('input')).toBeChecked();
  return row;
}

test('filter popover: a checked value keeps the selected tint', async ({ page }) => {
  const row = await checkFirstDocumentType(page);

  await page.mouse.move(0, 0);

  await expect(row, OPTION_ROW.checked.token).toHaveCSS(
    'background-color',
    OPTION_ROW.checked.value,
  );
});

test('filter popover: a checked value deepens on hover', async ({ page }) => {
  const row = await checkFirstDocumentType(page);

  await row.hover();

  await expect(row, OPTION_ROW.checkedHover.token).toHaveCSS(
    'background-color',
    OPTION_ROW.checkedHover.value,
  );
});
