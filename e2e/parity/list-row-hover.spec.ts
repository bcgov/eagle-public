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
import { expect, test } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';

const CASES = [
  { record: 'activities', width: 1280 },
  { record: 'activities', width: 400 },
  { record: 'notifications', width: 1280 },
  { record: 'notifications', width: 400 },
] as const;

for (const { record, width } of CASES) {
  test(`${record} @ ${width}: hover leaves the row untinted`, async ({ page }) => {
    await routeDemiSearch(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/search?record=${record}`, { waitUntil: 'networkidle' });

    const item = page.locator('li.display-grid__list-item').nth(1);
    const row = item.locator('.display-grid__row').first();

    const itemBefore = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rowBefore = await row.evaluate((el) => getComputedStyle(el).backgroundColor);

    await item.hover();

    await expect(item).toHaveCSS('background-color', itemBefore);
    await expect(row).toHaveCSS('background-color', rowBefore);
  });
}
