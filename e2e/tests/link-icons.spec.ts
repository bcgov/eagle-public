import { test, expect } from '../support/fixtures';
import type { APIRequestContext } from '@playwright/test';
import { ready, searchFixture } from '../support/helpers';

/**
 * Material icons that sit inside a link. Both cases are layout or cascade results, so only a real
 * browser sees them; each reads computed values off the live page rather than a snapshot.
 */

/** How many recent-update projects the file-link pick walks before giving up. */
const FILE_PROJECT_SCAN = 5;
/** The updates tab's page size: a file row further down never renders on the first page. */
const UPDATES_PAGE_SIZE = 10;

function hasDocument(row: any): boolean {
  const url = row?.documentUrl;
  return (
    (typeof url === 'string' && /^https?:\/\//.test(url)) ||
    (Array.isArray(row?.attachments) && row.attachments.length > 0)
  );
}

function projectIdOf(row: any): string | null {
  return typeof row?.project === 'object' ? (row.project?._id ?? null) : (row?.project ?? null);
}

/** The tab's first page: visible rows only, newest publish date (else date added) first. */
function firstTabPage(rows: any[]): any[] {
  const dateOf = (row: any) => Date.parse(row.publishDate || row.dateAdded) || 0;
  return rows
    .filter((row) => row.status == null || row.status === 'published')
    .sort((a, b) => dateOf(b) - dateOf(a))
    .slice(0, UPDATES_PAGE_SIZE);
}

/** A project whose updates tab shows an update with a document on its first page. */
async function projectWithFileUpdate(request: APIRequestContext): Promise<string | null> {
  const recent = await searchFixture(
    request,
    'dataset=RecentActivity&pageNum=0&pageSize=50&sortBy=-dateAdded&populate=true&fuzzy=false',
  );
  const candidates = [
    ...new Set(recent.filter(hasDocument).map(projectIdOf).filter(Boolean) as string[]),
  ].slice(0, FILE_PROJECT_SCAN);
  for (const projectId of candidates) {
    const rows = await searchFixture(
      request,
      `dataset=RecentActivity&pageNum=0&pageSize=250&sortBy=-publishDate&populate=true&fuzzy=false&and[project]=${projectId}`,
    );
    if (firstTabPage(rows).some(hasDocument)) return projectId;
  }
  return null;
}

test('an update card file icon keeps the secondary colour its document list sets', async ({
  page,
  request,
}) => {
  const projectId = await projectWithFileUpdate(request);
  test.skip(
    !projectId,
    `no project among the ${FILE_PROJECT_SCAN} with the newest file-linked updates shows one on its first updates page`,
  );

  await page.goto(`/p/${projectId}/updates`);
  await ready(page);

  // A card shows its documents only once opened, and then only once its Documents list is.
  for (const toggle of await page.locator('.update-card__toggle').all()) await toggle.click();
  for (const toggle of await page.locator('.update-detail__docs-toggle').all())
    await toggle.click();

  const link = page.locator('.update-detail__doc').first();
  await link.waitFor({ state: 'visible', timeout: 60_000 });

  // The reader's design: grey file icon, link-coloured name. A global icon or link rule must not win.
  const colours = await link.evaluate((a) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--typography-color-secondary)';
    a.append(probe);
    const secondary = getComputedStyle(probe).color;
    probe.remove();
    return {
      secondary,
      icon: getComputedStyle(a.querySelector(':scope > i.material-icons:not(.new-tab-hint__icon)')!)
        .color,
    };
  });
  expect(colours.icon).toBe(colours.secondary);
});

test('a new-tab icon stays on the line of the text before it at 330px', async ({ page }) => {
  await page.setViewportSize({ width: 330, height: 800 });
  // Its "2018 Environmental Assessment Act" link wrapped the icon alone onto a new line.
  await page.goto('/p/620aa098fd30c700220f2805/overview');
  await ready(page);
  await page.locator('.new-tab-hint__icon').first().waitFor({ state: 'visible', timeout: 60_000 });

  const placements = await page.locator('.new-tab-hint__icon').evaluateAll((icons) =>
    icons
      .filter((icon) => icon.getClientRects().length > 0)
      .map((icon) => {
        // Everything in the icon's parent up to the icon: the last rect is the text's last line.
        const before = document.createRange();
        before.setStart(icon.parentElement!, 0);
        before.setEndBefore(icon);
        const lines = [...before.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        const lastLine = lines.reduce((a, b) => (b.top > a.top ? b : a), lines[0]);
        const box = icon.getBoundingClientRect();
        return {
          text: (icon.parentElement!.textContent ?? '').trim().slice(0, 60),
          // The icon's box overlaps the text's last line box vertically.
          sameLine: !!lastLine && box.top < lastLine.bottom && box.bottom > lastLine.top,
        };
      }),
  );

  expect(placements.length, 'no visible new-tab icon on the overview').toBeGreaterThan(0);
  expect(placements.filter((p) => !p.sameLine)).toEqual([]);
});
