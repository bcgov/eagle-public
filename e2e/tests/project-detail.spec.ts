import { test, expect } from '../support/fixtures';
import {
  ready,
  recordApiCalls,
  checkBaseline,
  waitForSearch,
  total,
  pageCount,
  firstProjects,
  projectByKeyword,
  unwrap,
} from '../support/helpers';

const ROWS = 'table[aria-label="table-template"] tbody tr';
const NAME = 'td[data-label="Name"]';
const TABS = '.project-tabs nav a';
const DOC_TYPE_SEGMENTS = '.document-type-filter__segment';

/** Two real projects, resolved per environment instead of hard-coded. */
async function twoProjects(request: any) {
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
  await expect(page.getByRole('heading', { level: 2, name: 'Project Details' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Activities and Updates' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Contact Us' })).toBeVisible();

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
  // Application / Certificate / Amendment(s) / C&E Documents appear only when that project has
  // the documents.
  expect(
    labels.every((l) =>
      ['All Documents', 'Application', 'Certificate', 'Amendment(s)', 'C&E Documents'].includes(l),
    ),
  ).toBeTruthy();
});

test('documents tab renders a paged document table', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const calls = recordApiCalls(page);

  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/documents`);
  const env = await search;
  await ready(page);

  for (const col of ['Name', 'Date', 'Type', 'Milestone', 'Phase']) {
    await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
  }
  const rows = page.locator(ROWS);
  await expect(rows).toHaveCount(Math.min(10, total(env)));
  await expect(rows.first().locator(NAME)).toHaveText(env.searchResults[0].displayName.trim());
  expect((await pageCount(page)).total).toBe(total(env));

  checkBaseline('project-documents-tab', calls);
});

test('certificates tab lists certificate documents', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/documents/certificates`);
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
});

test('amendments tab lists amendment documents', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/documents/amendments`);
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
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
    await expect(page.locator('.tab-content')).toContainText(
      'There are no application documents associated with this project.',
    );
  }
});

test('engagement tab lists the project comment periods', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  await page.goto(`/p/${project._id}/engagement`);
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  const content = page.locator('.tab-content');
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

  // Both branches are accepted on purpose: prod's deployed build has no decisions route, so it
  // alerts and lands on /projects, while the port keeps the route resolvable and renders an empty
  // tab (`docs/deviations-from-angular.md`: the Angular decisions template was entirely
  // commented out).
  if (new URL(page.url()).pathname === '/projects') {
    expect(dialogs).toContain("Uh-oh, couldn't load project");
  } else {
    expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/decisions`);
    await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
    expect(dialogs).toEqual([]);
  }
});

test('a document download presigns through demi-api and keeps the eagle-api href', async ({
  page,
  request,
}) => {
  const [project] = await twoProjects(request);
  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/documents`);
  const env = await search;
  await ready(page);

  const documentId = env.searchResults[0]._id;

  // The href stays the eagle-api URL so middle-click and copy-link still fetch the file.
  const link = page.locator(ROWS).first().locator(NAME).locator('a');
  const href = await link.getAttribute('href');
  expect(href).toMatch(new RegExp(`^/api/public/document/${documentId}/download/.+`));

  // The click does not follow it: it asks demi-api for a presigned URL for that one document.
  const presign = page.waitForRequest(
    (r) =>
      r.method() === 'POST' &&
      /\/(api|demi-search)\/bulk-downloads$/.test(new URL(r.url()).pathname),
    { timeout: 20_000 },
  );
  await link.click();
  expect((await presign).postDataJSON().documentIds).toEqual([documentId]);
  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/documents`);

  // HEAD, so the assertion costs a status line rather than the whole file. Not every environment
  // holds the object behind every row - test is a partial copy - so a 404 is missing storage,
  // not a broken link. Only a server error means the endpoint itself is wrong.
  const head = await request.head(href!);
  expect(head.status()).toBeLessThan(500);
  test.info().annotations.push({ type: 'download HEAD', description: String(head.status()) });
});

test('@data project search API is scoped to the project', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const req = page.waitForRequest(
    (r) => r.url().includes('dataset=Document') && r.url().includes(`and[project]=${project._id}`),
  );
  await page.goto(`/p/${project._id}/documents`);
  const wire = new URL((await req).url()).searchParams;
  expect(wire.get('and[project]')).toBe(project._id);
  expect(wire.get('pageSize')).toBe('10');

  const direct = await request.get((await req).url());
  expect(direct.status()).toBe(200);
  expect(total(unwrap(await direct.json()))).toBeGreaterThan(0);
});
