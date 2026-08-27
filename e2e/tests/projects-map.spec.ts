import { test, expect, Page } from '../support/fixtures';
import { recordApiCalls, checkBaseline, waitForSearch, total } from '../support/helpers';

const CARDS = '#applist-list .app-card';

async function openMap(page: Page) {
  const search = waitForSearch(page, 'Project');
  await page.goto('/projects');
  const env = await search;
  await page.locator('.leaflet-container').waitFor();
  await expect(page.locator('.marker-cluster').first()).toBeVisible();
  await page.waitForTimeout(2000);
  return env;
}

test('map page renders the map, clusters and the project list', async ({ page }) => {
  const calls = recordApiCalls(page);
  const env = await openMap(page);

  // The h1 is deliberately visually hidden, so assert presence rather than visibility.
  await expect(page.locator('h1')).toHaveText('Find Environmental Assessment Projects in British Columbia');
  await expect(page.locator('#map.leaflet-container')).toBeAttached();
  await expect(page.locator('.marker-cluster')).not.toHaveCount(0);
  await expect(page.locator(CARDS)).not.toHaveCount(0);
  await expect(page.locator('.app-list__options')).toContainText(`${total(env)} results on map`);

  checkBaseline('projects-map', calls);
});

test('the list panel starts closed and the overlay toggles it', async ({ page }) => {
  await openMap(page);

  const view = page.locator('.projects-view');
  await expect(view).toHaveClass(/app-list-closed/);

  // The overlay is the only toggle prod exposes; it is transparent while closed.
  const overlay = page.locator('.overlay');
  await overlay.dispatchEvent('click');
  await expect(view).toHaveClass(/app-list-open/);
  await expect(page.locator(CARDS).first()).toBeVisible();

  await overlay.dispatchEvent('click');
  await expect(view).toHaveClass(/app-list-closed/);
});

test('@data the project-name filter narrows the list and the map', async ({ page }) => {
  const env = await openMap(page);

  const filtered = page.locator('.app-list__options');
  await page.fill('#applicantInput', 'Coal');
  await expect(filtered).not.toContainText(`${total(env)} results on map`);

  const text = await filtered.innerText();
  const remaining = Number(text.match(/(\d+) results on map/)?.[1] ?? 0);
  expect(remaining).toBeGreaterThan(0);
  expect(remaining).toBeLessThan(total(env));
  // The card body carries applicant/purpose/status, never the project name, so the
  // narrowing is asserted on the counts rather than on row text.
  expect(await page.locator(CARDS).count()).toBeGreaterThan(0);
});

test('clicking a marker opens the project detail popup', async ({ page }) => {
  await openMap(page);

  // Whether any project sits unclustered at the opening zoom depends on the viewport, the data
  // volume and the fitted zoom, so drill into clusters until a single marker exists rather than
  // assuming one is on screen already.
  const marker = page.locator('.leaflet-marker-icon:not(.marker-cluster)').first();
  for (let attempt = 0; attempt < 5 && (await marker.count()) === 0; attempt++) {
    await page.locator('.marker-cluster').first().click();
    await page.waitForTimeout(1500);
  }
  await marker.waitFor();
  // Dispatched, not a coordinate click: the header and the filter card float over the map, so a
  // marker under either of them is unhittable by pointer. Leaflet listens for the DOM event.
  await marker.dispatchEvent('click');

  await expect(page.locator('.leaflet-popup')).toHaveCount(1);
  await expect(page.locator('.popup-title')).toContainText('Project');
  await expect(page.locator('.popup-content .app-link')).toHaveText(/View Project Details/i);
});

test('clicking a cluster drills into it', async ({ page }) => {
  await openMap(page);

  const clusters = page.locator('.marker-cluster');
  const before = await clusters.count();
  await clusters.first().click();
  await page.waitForTimeout(2500);

  // Zoom or spiderfy: either way the cluster layout must change.
  const after = await clusters.count();
  const markers = await page.locator('.leaflet-marker-icon:not(.marker-cluster)').count();
  expect(after !== before || markers > 0).toBeTruthy();
});

test('a list card selects its project in the list', async ({ page }) => {
  await openMap(page);

  await page.locator('.overlay').dispatchEvent('click');
  const card = page.locator(CARDS).first();
  await expect(card).toBeVisible();

  // The map canvas covers the list panel, so a coordinate click lands on the map;
  // the app listens for the click event itself.
  await card.dispatchEvent('click');
  await expect(card).toHaveClass(/active/);
  // Recorded prod behaviour: selecting from the list does NOT open the map popup;
  // only a marker click does.
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
});
