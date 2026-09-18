/**
 * Hover tint on the /search list rows (activities, notifications).
 *
 * The tint belongs to the whole list item, not to the row inside it: painting the inner row left
 * the item's own padding and divider untinted, and below 768px a grey `.pn-location-info` fill
 * sat on notification rows regardless of hover. Both are CSS-only, so only a real browser sees them.
 *
 * Runs under the parity config: local preview build, every backend read answered from
 * `e2e/fixtures/unified-search`, nothing leaves the box.
 */
import { expect, test } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';

/** `--theme-blue-10`, read off the design tokens: #F1F8FE. */
const HOVER_TINT = 'rgb(241, 248, 254)';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const CASES = [
  { record: 'activities', width: 1280 },
  { record: 'activities', width: 400 },
  { record: 'notifications', width: 1280 },
  { record: 'notifications', width: 400 },
] as const;

for (const { record, width } of CASES) {
  test(`${record} @ ${width}: hover tints the list item, not the row inside it`, async ({
    page,
  }) => {
    await routeDemiSearch(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/search?record=${record}`, { waitUntil: 'networkidle' });

    const item = page.locator('li.display-grid__list-item').nth(1);
    await item.hover();

    await expect(item).toHaveCSS('background-color', HOVER_TINT);
    await expect(item.locator('.display-grid__row').first()).toHaveCSS(
      'background-color',
      TRANSPARENT,
    );
  });
}
