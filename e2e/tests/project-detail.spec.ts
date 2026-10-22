import type { APIRequestContext, Request } from '@playwright/test';
import { test, expect, type Page } from '../support/fixtures';
import {
  ready,
  recordApiCalls,
  checkBaseline,
  gridCount,
  firstProjects,
  jsonBody,
  projectByKeyword,
} from '../support/helpers';

const ROWS = '.display-grid__table tbody tr';
const NAME = 'td.display-grid__cell:not(.display-grid__cell--select)';
const TABS = '.project-tabs nav a';
const DOC_TYPE_SEGMENTS = '.document-type-filter__segment';

/** DEMI's native document list, which every project document table reads. */
const DOCUMENT_READ = /\/demi\/api\/documents\?/;

/**
 * The next document read whose URL contains `mustContain`, which skips the shell's pageSize=1 tab
 * probes and pageSize=5 featured read. Returns its rows and the `x-total-count` total.
 */
function waitForDocuments(page: Page, mustContain: string) {
  return page
    .waitForResponse(
      (r) => DOCUMENT_READ.test(r.url()) && r.url().includes(mustContain) && r.status() === 200,
      { timeout: 60_000 },
    )
    .then(async (r) => ({
      rows: (await r.json()) as { id: string; displayName: string; mimeType?: string }[],
      total: Number(r.headers()['x-total-count']),
    }));
}

/** Two real projects, resolved per environment instead of hard-coded. */
async function twoProjects(request: APIRequestContext) {
  const named = await projectByKeyword(request, 'Site C');
  const [first] = await firstProjects(request, 1);
  return [named, first];
}

test('project detail defaults to the overview tab', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const calls = recordApiCalls(page);

  await page.goto(`/p/${project._id}`);
  await ready(page);

  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/overview`);
  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'About this project' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Contact' })).toBeVisible();

  checkBaseline('overview-tab', calls);
});

test('the tab strip always offers the four core tabs, and only ever adds Decisions or Compliance', async ({
  page,
  request,
}) => {
  for (const project of await twoProjects(request)) {
    await page.goto(`/p/${project._id}/overview`);
    await ready(page);
    // A label carries its count, so match the prefix: "Documents 1,284".
    const labels = (await page.locator(TABS).allInnerTexts()).map((t) => t.trim());
    const names = labels.map((label) => label.split(/\s/)[0]);
    expect(names.slice(0, 4)).toEqual(['Overview', 'Updates', 'Engagement', 'Documents']);
    expect(names.slice(4).every((name) => ['Decisions', 'Compliance'].includes(name))).toBeTruthy();
    await expect(page.locator(`${TABS}[aria-current="page"]`)).toHaveText(/^Overview/);
  }
});

test('the renamed tab paths still resolve', async ({ page, request }) => {
  const [project] = await twoProjects(request);

  for (const [from, to] of [
    ['project-details', 'overview'],
    ['commenting', 'engagement'],
  ]) {
    await page.goto(`/p/${project._id}/${from}`);
    await page.waitForURL(`**/p/${project._id}/${to}`);
    expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/${to}`);
  }
});

test('the Documents tab carries a document-type filter', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  await page.goto(`/p/${project._id}/documents`);
  await ready(page);

  const labels = (await page.locator(DOC_TYPE_SEGMENTS).allInnerTexts()).map((t) => t.trim());
  expect(labels[0]).toBe('All Documents');
  // Application / Certificate / Amendment(s) / C&E Documents / Management Plan appear only when
  // that project has the documents.
  expect(
    labels.every((l) =>
      [
        'All Documents',
        'Application',
        'Certificate',
        'Amendment(s)',
        'C&E Documents',
        'Management Plan',
      ].includes(l),
    ),
  ).toBeTruthy();
});

test('documents tab renders a paged document table', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const calls = recordApiCalls(page);

  const read = waitForDocuments(page, 'pageSize=10');
  await page.goto(`/p/${project._id}/documents`);
  const docs = await read;
  await ready(page);

  for (const col of ['Name', 'Date', 'Type', 'Milestone', 'Phase']) {
    await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
  }
  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(Math.min(10, docs.total));
  // The name cell can also carry the featured star, so assert on the document link itself. A PDF's
  // link also says it opens in a new tab, so the name is only part of its text.
  await expect(rows.first().locator(NAME).first().locator('a')).toContainText(
    docs.rows[0].displayName.trim(),
  );
  expect((await gridCount(page)).total).toBe(docs.total);

  checkBaseline('project-documents-tab', calls);
});

test('certificates tab lists certificate documents', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const read = waitForDocuments(page, 'pageSize=10');
  await page.goto(`/p/${project._id}/documents/certificates`);
  const docs = await read;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, docs.total));
});

test('amendments tab lists amendment documents', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const read = waitForDocuments(page, 'pageSize=10');
  await page.goto(`/p/${project._id}/documents/amendments`);
  const docs = await read;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, docs.total));
});

test('application tab renders, with an empty-state when the project has no application documents', async ({
  page,
  request,
}) => {
  const [project] = await twoProjects(request);
  // The old top-level path, which must still land on the sub-tab.
  await page.goto(`/p/${project._id}/application`);
  await ready(page);

  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/documents/application`);
  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();

  const rows = await page.locator(ROWS).count();
  if (rows === 0) {
    await expect(page.locator('.project-page__content')).toContainText(
      'There are no application documents associated with this project.',
    );
  }
});

test('engagement tab lists the project comment periods', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  await page.goto(`/p/${project._id}/engagement`);
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  const content = page.locator('.project-page__content');
  await expect(content).toContainText(/CLOSED|OPEN|No comment periods|Closed|Open/i);
});

test('decisions tab route either resolves or bounces to /projects', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });

  await page.goto(`/p/${project._id}/decisions`);
  await page.waitForTimeout(5_000);

  // Prod's build has no decisions route, so it alerts and lands on /projects; the port renders an
  // empty tab (`docs/deviations-from-angular.md`). Both are accepted.
  if (new URL(page.url()).pathname === '/projects') {
    expect(dialogs).toContain("Uh-oh, couldn't load project");
  } else {
    expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/decisions`);
    await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
    expect(dialogs).toEqual([]);
  }
});

/** The request a redirect chain started from. */
function chainStart(request: Request): Request {
  const from = request.redirectedFrom();
  return from ? chainStart(from) : request;
}

/** The documents tab of a real project, and its first row whose stated type `pick` accepts. */
async function documentRow(
  page: Page,
  request: APIRequestContext,
  pick: (mime: string) => boolean,
) {
  const [project] = await twoProjects(request);
  const read = waitForDocuments(page, 'pageSize=10');
  await page.goto(`/p/${project._id}/documents`);
  const docs = await read;
  await ready(page);
  const index = docs.rows.findIndex((row) => pick((row.mimeType ?? '').toLowerCase()));
  return {
    project,
    index,
    documentId: docs.rows[index]?.id,
    link: page.locator(ROWS).nth(index).locator(NAME).first().locator('a'),
  };
}

test('a PDF opens in a new tab at the inline view, without presigning', async ({
  page,
  request,
}) => {
  const { project, index, documentId, link } = await documentRow(
    page,
    request,
    (mime) => mime === 'application/pdf',
  );
  test.skip(index < 0, 'no PDF on the first page of documents in this environment');

  expect(await link.getAttribute('href')).toBe(
    `/demi-search/documents/${documentId}/download?inline=1`,
  );
  const presigned: string[] = [];
  page.on('request', (r) => {
    if (/\/demi-search\/bulk-downloads$/.test(new URL(r.url()).pathname)) presigned.push(r.url());
  });
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.url()));
  const popup = page.waitForEvent('popup', { timeout: 20_000 });
  // A noopener tab reports an empty url() at first, so watch for the response carrying the file:
  // demi-api streams it, or 302s to a presigned URL for a large file.
  const fileResponse = page.context().waitForEvent('response', {
    predicate: (r) =>
      chainStart(r.request()).url().includes(`/documents/${documentId}/download`) &&
      !!r.headers()['content-disposition'],
    timeout: 20_000,
  });
  await link.click();
  await popup;
  const file = await fileResponse;
  const opened = chainStart(file.request()).url();
  expect(opened).toContain('inline=1');
  expect(file.headers()['content-disposition']).toMatch(/^inline/);
  // Headless Chromium has no PDF viewer, so it saves the tab, and Playwright reports that on the
  // opener; any other download is the app's.
  expect(downloads.filter((url) => url !== opened && url !== file.url())).toEqual([]);
  expect(presigned).toEqual([]);
  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/documents`);
});

test('a document download presigns through demi-api and keeps the eagle-api href', async ({
  page,
  request,
}) => {
  // A stated type the browser has no viewer for; a generic or missing one is decided by name.
  const { project, index, documentId, link } = await documentRow(
    page,
    request,
    (mime) =>
      mime !== '' &&
      !/^(application\/pdf|image\/png|image\/jpeg)\b/.test(mime) &&
      !/^(application\/octet-stream|binary\/octet-stream|application\/x-download)\b/.test(mime),
  );
  test.skip(index < 0, 'no downloadable-only document on the first page in this environment');

  // The href stays a real download URL so middle-click and copy-link still fetch the file.
  const href = await link.getAttribute('href');
  expect(href).toBe(`/demi-search/documents/${documentId}/download?redirect=1`);

  // The click does not follow it: it asks demi-api for a presigned URL for that one document.
  const presign = page.waitForRequest(
    (r) =>
      r.method() === 'POST' && /\/demi-search\/bulk-downloads$/.test(new URL(r.url()).pathname),
    { timeout: 20_000 },
  );
  await link.click();
  expect((await presign).postDataJSON().documentIds).toEqual([documentId]);
  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/documents`);

  // HEAD costs a status line, not the file. Test holds a partial copy of storage, so a 404 is a
  // missing object; only a server error means the endpoint is wrong.
  const head = await request.head(href!);
  expect(head.status()).toBeLessThan(500);
  test.info().annotations.push({ type: 'download HEAD', description: String(head.status()) });
});

test('the subscribe form opens rightward from the band trigger', async ({ page, request }) => {
  const [project] = await twoProjects(request);

  // The control needs NOTIFY_API, which only each deploy's env.js carries. Add it to the
  // environment's own config so the other runtime values stay real.
  await page.route('**/demi-search/config', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), NOTIFY_API: '/notify-api' },
    });
  });

  await page.goto(`/p/${project._id}/overview`);
  await ready(page);

  // The overview tab offers a second sign-up further down the page; this is the band's own.
  const masthead = page.locator('.subscribe-popover--masthead');
  await masthead.getByRole('button', { name: 'Subscribe to updates' }).click();

  await expect(masthead.locator('.subscribe-popover__panel')).toBeVisible();
  const boxes = await page.evaluate(() => {
    const button = document.querySelector(
      '.subscribe-popover--masthead .subscribe-popover__trigger',
    ) as HTMLElement;
    const sheet = document.querySelector(
      '.subscribe-popover--masthead .subscribe-popover__panel',
    ) as HTMLElement;
    return {
      trigger: button.getBoundingClientRect().toJSON(),
      panel: sheet.getBoundingClientRect().toJSON(),
    };
  });

  // The trigger sits at the content's left edge, so a panel hanging the other way would spill
  // into the page gutter.
  expect(boxes.panel.left).toBeGreaterThanOrEqual(boxes.trigger.left - 1);
  expect(boxes.panel.right).toBeGreaterThan(boxes.trigger.right);
});

test('@data project document read is scoped to the project', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  // DEMI files a project's documents under its Track id, not the Eagle id in the URL.
  const demi = await jsonBody(
    await request.get(`/demi-projects/${project._id}`),
    `demi project ${project._id}`,
  );
  const req = page.waitForRequest(
    (r) => DOCUMENT_READ.test(r.url()) && r.url().includes('pageSize=10'),
  );
  await page.goto(`/p/${project._id}/documents`);
  const wire = new URL((await req).url()).searchParams;
  expect(wire.get('project')).toBe(String(demi.id));
  expect(wire.get('pageSize')).toBe('10');

  const direct = await request.get((await req).url());
  expect(direct.status()).toBe(200);
  expect(Number(direct.headers()['x-total-count'])).toBeGreaterThan(0);
});
