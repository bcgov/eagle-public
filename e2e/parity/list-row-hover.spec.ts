/**
 * Hover on the /search rows: activities list items, notifications table rows and cards.
 *
 * These rows carry no click target, so there is no hover affordance: background colour must stay
 * the same before and after hover, for the row and for the part inside it alike. CSS-only, so only
 * a real browser sees it.
 *
 * Runs under the parity config: local preview build, every backend read answered from
 * `e2e/fixtures/unified-search`, nothing leaves the box.
 */
import { expect, type Page } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { test, VIEWPORT } from './capture';
import { computed, LIST_ROW_RULE, rootFontPx } from './tokens';

const LIST = 'li.display-grid__list-item';
const ROW = '.display-grid__row';

/** `item` is the hovered row, `inner` the part inside it whose background must hold too. */
const HOVER_CASES = [
  { record: 'activities', width: 1280, item: LIST, inner: ROW },
  { record: 'activities', width: 400, item: LIST, inner: ROW },
  // Wide notifications are a table; the name cell is skipped as its link has its own hover.
  {
    record: 'notifications',
    width: 1280,
    item: 'tr.display-grid__row',
    inner: 'td.display-grid__cell:not(:has(a))',
  },
  { record: 'notifications', width: 400, item: 'li.display-grid__card', inner: ROW },
] as const;

const RULE_CASES = HOVER_CASES.filter((c) => c.item === LIST);

async function openSearch(page: Page, record: string, width: number) {
  await routeDemiSearch(page);
  await page.setViewportSize({ width, height: VIEWPORT.height });
  await page.goto(`/search?record=${record}`, { waitUntil: 'networkidle' });
}

for (const { record, width, item: itemSelector, inner } of HOVER_CASES) {
  test(`${record} @ ${width}: hover leaves the row untinted`, async ({ page }) => {
    await openSearch(page, record, width);
    const item = page.locator(itemSelector).nth(1);
    const row = item.locator(inner).first();

    const itemBefore = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rowBefore = await row.evaluate((el) => getComputedStyle(el).backgroundColor);

    await item.hover();

    await expect(item).toHaveCSS('background-color', itemBefore);
    await expect(row).toHaveCSS('background-color', rowBefore);
  });
}

for (const { record, width } of RULE_CASES) {
  test(`${record} @ ${width}: rows are ruled in ${LIST_ROW_RULE.colour.token}`, async ({
    page,
  }) => {
    await openSearch(page, record, width);
    const item = page.locator(LIST).first();
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
