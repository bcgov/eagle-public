import { test, expect, Page } from '../support/fixtures';
import { recordApiCalls, checkBaseline, waitForSearch, total } from '../support/helpers';

const CARDS = '[data-testid="project-card"]';
const COUNT = '[data-testid="results-count"]';
const CLUSTERS = '[data-testid="map-cluster"]';
const MARKERS = '[data-testid="map-marker"]';
/** The selected project's card, fixed in the map's bottom-left corner. */
const POPUP = '.map-info[data-testid="map-popup"]';

async function openMap(page: Page) {
  const search = waitForSearch(page, 'Project');
  await page.goto('/projects');
  const env = await search;
  // The WebGL canvas is inside the map region; it has no size until the style loads.
  await page
    .locator(`[data-testid="project-map"] .maplibregl-canvas`)
    .waitFor({ state: 'attached' });
  await expect(page.locator(CLUSTERS).first()).toBeVisible();
  await page.waitForTimeout(2000);
  return env;
}

function countIn(text: string): number {
  return Number(text.match(/(\d+) projects? in view/)?.[1] ?? 0);
}

/** Zoom into clusters until the map shows a single-project pin. */
async function firstMarker(page: Page) {
  const marker = page.locator(MARKERS).first();
  for (let attempt = 0; attempt < 6 && !(await marker.isVisible()); attempt++) {
    await page.locator(CLUSTERS).first().click();
    await page.waitForTimeout(1500);
  }
  await expect(marker).toBeVisible();
  return marker;
}

test('map page renders the map, clusters and the project list', async ({ page }) => {
  const calls = recordApiCalls(page);
  const env = await openMap(page);

  // The h1 is deliberately visually hidden, so assert presence rather than visibility.
  await expect(page.locator('h1')).toHaveText(
    'Find Environmental Assessment Projects in British Columbia',
  );
  await expect(page.locator('[data-testid="project-map"] .maplibregl-canvas')).toBeAttached();
  await expect(page.locator(CLUSTERS)).not.toHaveCount(0);
  await expect(page.locator(CARDS)).not.toHaveCount(0);

  // Projects without a centroid are not on the map, so the count is bounded by the result total.
  const shown = countIn(await page.locator(COUNT).innerText());
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(total(env));

  checkBaseline('projects-map', calls);
});

test('the Filters button expands the advanced filters inline', async ({ page }) => {
  await openMap(page);

  const panel = page.locator('#applist-filters');
  const toggle = page.getByRole('button', { name: /Filters/ });
  await expect(panel).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#region')).toBeHidden();

  await toggle.click();

  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#region')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(panel).toHaveAttribute('data-open', 'false');
  await expect(toggle).toBeFocused();
});

test('@data the project-name filter narrows the list and the map', async ({ page }) => {
  await openMap(page);

  const before = countIn(await page.locator(COUNT).innerText());
  await page.fill('#applicantInput', 'Coal');
  await expect(page.locator(COUNT)).not.toHaveText(`${before} projects in view`);

  const after = countIn(await page.locator(COUNT).innerText());
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThan(before);
  expect(await page.locator(CARDS).count()).toBeGreaterThan(0);
});

test('clicking a pin opens the project card', async ({ page }) => {
  await openMap(page);

  const marker = await firstMarker(page);
  const projectId = await marker.getAttribute('data-project-id');
  await marker.click();

  const popup = page.locator(POPUP);
  await expect(popup).toHaveCount(1);
  await expect(popup.locator('.popup-title')).not.toBeEmpty();
  await expect(popup.locator('.popup-subtitle')).toBeVisible();
  await expect(popup.getByRole('button', { name: 'View project' })).toBeVisible();
  // The pin and the card are two views of one selection.
  await expect(page.locator(`${CARDS}[data-project-id="${projectId}"]`)).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('clicking a list card selects it and opens the project card', async ({ page }) => {
  await openMap(page);

  const card = page.locator(CARDS).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(card).toHaveAttribute('aria-current', 'true');
  await expect(page.locator(POPUP)).toHaveCount(1);
});

test('the Layers menu switches the base map tiles', async ({ page }) => {
  await openMap(page);

  const topoTile = page.waitForRequest(/World_Topo_Map/, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Map layers' }).click();
  await page.getByRole('radio', { name: 'World Topographic' }).click();

  await topoTile;
});
