import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { searchFixture } from '../support/helpers';

/** The newest notification, read the way the notifications search tab reads them. */
async function newestNotification(request: APIRequestContext) {
  const [notification] = await searchFixture(
    request,
    'dataset=ProjectNotification&pageNum=0&pageSize=1&projectLegislation=default&sortBy=-notificationReceivedDate&populate=true&fuzzy=false',
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

  await page.goto(`/pn/${pn._id}`);
  await page.waitForURL(`**/pn/${pn._id}/overview`);

  await expect(page.getByRole('heading', { level: 1, name: pn.name })).toBeVisible();
  await expect(page.getByText(/^Project notification/).first()).toBeVisible();
  const strip = page.getByRole('navigation', { name: 'Project notification sections' });
  await expect(strip.getByRole('link')).toHaveText([/^Overview/, /^Engagement/, /^Documents/]);

  await strip.getByRole('link', { name: /^Engagement/ }).click();
  await page.waitForURL(`**/pn/${pn._id}/engagement`);
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

  await strip.getByRole('link', { name: /^Documents/ }).click();
  await page.waitForURL(`**/pn/${pn._id}/documents`);
  await expect(page.getByRole('heading', { level: 2, name: 'Documents' })).toBeVisible();
  await expect(strip.getByRole('link', { name: /^Documents/ })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // DEMI holds projects only: a notification id there would just 404.
  expect(demiReads.filter((url) => url.includes(pn._id))).toEqual([]);
});
