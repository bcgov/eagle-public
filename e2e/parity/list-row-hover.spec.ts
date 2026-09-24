/**
 * Hover on the /search list rows (activities, notifications).
 *
 * These rows carry no click target, so there is no hover affordance: background colour must stay
 * the same before and after hover, for the list item and for the inner `.display-grid__row` alike.
 * CSS-only, so only a real browser sees it.
 *
 * Runs under the parity config: local preview build, every backend read answered from
 * `e2e/fixtures/unified-search`, nothing leaves the box.
 */
import { expect, type Page } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { test, VIEWPORT } from './capture';
import { computed, LIST_ROW_RULE, rootFontPx } from './tokens';

const CASES = [
  { record: 'activities', width: 1280 },
  { record: 'activities', width: 400 },
  { record: 'notifications', width: 1280 },
  { record: 'notifications', width: 400 },
] as const;

async function openList(page: Page, record: string, width: number) {
  await routeDemiSearch(page);
  await page.setViewportSize({ width, height: VIEWPORT.height });
  await page.goto(`/search?record=${record}`, { waitUntil: 'networkidle' });
  return page.locator('li.display-grid__list-item');
}

for (const { record, width } of CASES) {
  test(`${record} @ ${width}: hover leaves the row untinted`, async ({ page }) => {
    const item = (await openList(page, record, width)).nth(1);
    const row = item.locator('.display-grid__row').first();

    const itemBefore = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rowBefore = await row.evaluate((el) => getComputedStyle(el).backgroundColor);

    await item.hover();

    await expect(item).toHaveCSS('background-color', itemBefore);
    await expect(row).toHaveCSS('background-color', rowBefore);
  });

  test(`${record} @ ${width}: rows are ruled in ${LIST_ROW_RULE.colour.token}`, async ({
    page,
  }) => {
    const item = (await openList(page, record, width)).first();
    const { element, colour, width: ruleWidth, style } = LIST_ROW_RULE;
    await expect(item, `${element} colour (${colour.token})`).toHaveCSS(
      'border-bottom-color',
      colour.value,
    );
    await expect(item, `${element} width (${ruleWidth.token})`).toHaveCSS(
      'border-bottom-width',
      computed(ruleWidth.value, await rootFontPx(page)),
    );
    await expect(item, `${element} style`).toHaveCSS('border-bottom-style', style.value);
  });
}
