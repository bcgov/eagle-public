import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { jsonBody } from '../support/helpers';

/** The newest notification, from DEMI's native list. Its `id` is the Eagle id `/pn/` takes. */
async function newestNotification(request: APIRequestContext) {
  const query = 'pageSize=1&sort=-notificationReceivedDate';
  const [notification] = await jsonBody(
    await request.get(`/demi/api/notifications?${query}`),
    `notifications ${query}`,
  );
  expect(notification, 'no project notifications on this environment').toBeTruthy();
  return notification;
}

test('a project notification opens on /pn/ and walks its Overview, Engagement and Documents tabs', async ({
  page,
  request,
}) => {
  const pn = await newestNotification(request);
  const demiReads: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/demi-projects/')) demiReads.push(req.url());
  });

  await page.goto(`/pn/${pn.id}`);
  await page.waitForURL(`**/pn/${pn.id}/overview`);

  await expect(page.getByRole('heading', { level: 1, name: pn.name })).toBeVisible();
  // A populated proponent arrives as an organization object, not a string.
  const proponent = typeof pn.proponent === 'object' ? pn.proponent?.name : pn.proponent;
  // Same rule as src/app/utils/project-place.ts: town, then "<region> region", never doubled.
  const area = pn.region?.trim();
  const regionLabel = area && (/region$/i.test(area) ? area : `${area} region`);
  const place = [pn.location?.trim(), regionLabel].filter(Boolean).join(', ');
  const masthead = ['Project notification', proponent, place].filter(Boolean).join(' · ');
  await expect(page.getByText(masthead, { exact: true })).toBeVisible();
  const strip = page.getByRole('navigation', { name: 'Project notification sections' });
  await expect(strip.getByRole('link')).toHaveText([/^Overview/, /^Engagement/, /^Documents/]);

  await strip.getByRole('link', { name: /^Engagement/ }).click();
  await page.waitForURL(`**/pn/${pn.id}/engagement`);
  await expect(page.getByRole('heading', { level: 2, name: 'Engagement' })).toBeVisible();
  // Either a titled period or the empty line: the loading skeleton has neither.
  await expect(
    page
      .locator('.engagement-tab')
      .getByRole('heading', { level: 3 })
      .first()
      .or(
        page.getByText('No comment periods are currently scheduled for this project notification.'),
      ),
  ).toBeVisible();

  // DEMI files a notification's documents under its own Eagle id.
  const tableRead = page.waitForRequest(
    (r) => /\/demi\/api\/documents\?/.test(r.url()) && r.url().includes('pageSize=10'),
  );
  await strip.getByRole('link', { name: /^Documents/ }).click();
  await page.waitForURL(`**/pn/${pn.id}/documents`);
  expect(new URL((await tableRead).url()).searchParams.get('project')).toBe(pn.id);
  await expect(page.getByRole('heading', { level: 2, name: 'Documents' })).toBeVisible();
  await expect(strip.getByRole('link', { name: /^Documents/ })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // DEMI holds projects only: a notification id there would just 404.
  expect(demiReads.filter((url) => url.includes(pn.id))).toEqual([]);
});
