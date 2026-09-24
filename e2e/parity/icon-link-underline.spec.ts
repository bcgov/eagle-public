/**
 * Hover underline on links that carry a Material icon.
 *
 * A flex link blockifies its icon, and a link's underline paints across every block child, so the
 * line ran under the icon too. The link's own line is painted clear and the `.link-label` span
 * draws it under the words only. CSS-only, so only a real browser sees it.
 *
 * Runs under the parity config: local preview build, every backend read answered from
 * `e2e/fixtures/unified-search`, nothing leaves the box.
 */
import { expect, type Locator } from '@playwright/test';

import { routeDemiSearch } from '../fixtures/unified-search/demi-search';
import { test } from './capture';
import { selectorFor } from './selectors';
import { HELP_HOVER, HELP_REST } from './tokens';

const CLEAR = 'rgba(0, 0, 0, 0)';

async function expectUnderlineOnLabelOnly(link: Locator) {
  await link.hover();
  // The link's own line would run under the icon, so it must paint clear.
  await expect(link).toHaveCSS('text-decoration-color', CLEAR);
  const label = link.locator(':scope > .link-label');
  await expect(label).toHaveCSS('text-decoration-line', 'underline');
  await expect(label).not.toHaveCSS('text-decoration-color', CLEAR);
}

test.beforeEach(async ({ page }) => {
  await routeDemiSearch(page);
});

test('flex icon links underline the label, not the icon', async ({ page }) => {
  await page.goto('/search?record=activities', { waitUntil: 'networkidle' });
  const help = page.locator('a.unified-search__help');
  await expect(help).toHaveCSS('display', 'flex');
  await expectUnderlineOnLabelOnly(help);

  const attachment = page.locator('.display-grid__row-docs a').first();
  await expect(attachment).toHaveCSS('display', /flex/);
  await expectUnderlineOnLabelOnly(attachment);
});

test(`search help link turns from ${HELP_REST.token} to ${HELP_HOVER.token} on hover`, async ({
  page,
}) => {
  await page.goto('/search?record=activities', { waitUntil: 'networkidle' });
  // `.first()`: the page also links "Advanced search help".
  const help = page.locator(selectorFor('searchHelpLink', 'app')).first();
  // Read at rest first, so a link that is always gold cannot pass.
  await expect(help, `${HELP_REST.element} (${HELP_REST.token})`).toHaveCSS(
    'color',
    HELP_REST.value,
  );
  await help.hover();
  await expect(help, `${HELP_HOVER.element} (${HELP_HOVER.token})`).toHaveCSS(
    'color',
    HELP_HOVER.value,
  );
});

test('inline icon links underline the label, not the icon', async ({ page }) => {
  await page.goto('/search?record=activities', { waitUntil: 'networkidle' });
  // No inline icon link renders on /search, so this one is built the way ExternalLink builds it.
  await page.locator('main').evaluate((main) => {
    main.insertAdjacentHTML(
      'afterbegin',
      '<p><a id="inline-icon-link" href="#x"><span class="link-label">Report</span>' +
        '<i class="material-icons new-tab-hint__icon" aria-hidden="true">open_in_new</i></a></p>',
    );
  });
  const link = page.locator('#inline-icon-link');
  await expect(link).toHaveCSS('display', 'inline');
  await expectUnderlineOnLabelOnly(link);
});

test('home icon links underline the label, not the icon', async ({ page }) => {
  // The fixture carries no home feed, so it answers empty; added last, this route wins. Both links
  // render regardless: the browse strip is static and the feed footer always shows.
  await page.route(/dataset=HomeFeed/, (route) =>
    route.fulfill({
      json: [{ searchResults: [], meta: [{ searchResultsTotal: 0, dropped: [] }] }],
    }),
  );
  await page.goto('/', { waitUntil: 'networkidle' });
  await expectUnderlineOnLabelOnly(page.locator('a.home-browse__link').first());
  await expectUnderlineOnLabelOnly(page.locator('a.home-updates__all'));
});
