import { test, expect } from '@playwright/test';
import {
  ready, recordApiCalls, checkBaseline, waitForSearch, total, pageCount,
  firstProjects, projectByKeyword, unwrap,
} from '../support/helpers';

const ROWS = 'table[aria-label="table-template"] tbody tr';
const NAME = 'td[data-label="Name"]';
const TABS = '.project-tabs .nav-tabs .nav-link';

/** Two real projects, resolved per environment instead of hard-coded. */
async function twoProjects(request: any) {
  const named = await projectByKeyword(request, 'Site C');
  const [first] = await firstProjects(request, 1);
  return [named, first];
}

test('project detail defaults to the project-details tab', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const calls = recordApiCalls(page);

  await page.goto(`/p/${project._id}`);
  await ready(page);

  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/project-details`);
  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Project Details' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Activities and Updates' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Contact Us' })).toBeVisible();

  checkBaseline('project-details-tab', calls);
});

test('the tab strip always offers Project Details, Commenting and Documents', async ({ page, request }) => {
  for (const project of await twoProjects(request)) {
    await page.goto(`/p/${project._id}/project-details`);
    await ready(page);
    const labels = (await page.locator(TABS).allInnerTexts()).map(t => t.trim());
    expect(labels.slice(0, 3)).toEqual(['Project Details', 'Commenting', 'Documents']);
    // Certificate / Amendment(s) / Unsubscribe appear only when that project has the documents.
    expect(labels.every(l => ['Project Details', 'Commenting', 'Documents', 'Application', 'Certificate', 'Amendment(s)', 'Unsubscribe'].includes(l))).toBeTruthy();
  }
});

test('documents tab renders a paged document table', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const calls = recordApiCalls(page);

  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/documents`);
  const env = await search;
  await ready(page);

  for (const col of ['Name', 'Date', 'Type', 'Milestone', 'Phase']) {
    await expect(page.getByRole('columnheader', { name: new RegExp(`Column header ${col}`) })).toBeVisible();
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
  await page.goto(`/p/${project._id}/certificates`);
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
});

test('amendments tab lists amendment documents', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/amendments`);
  const env = await search;
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  await expect(page.locator(ROWS)).toHaveCount(Math.min(10, total(env)));
});

test('application tab renders, with an empty-state when the project has no application documents', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  await page.goto(`/p/${project._id}/application`);
  await ready(page);

  expect(new URL(page.url()).pathname).toBe(`/p/${project._id}/application`);
  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();

  const rows = await page.locator(ROWS).count();
  if (rows === 0) {
    await expect(page.locator('.tab-content')).toContainText('There are no application documents associated with this project.');
  }
});

test('commenting tab lists the project comment periods', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  await page.goto(`/p/${project._id}/commenting`);
  await ready(page);

  await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible();
  const content = page.locator('.tab-content');
  await expect(content).toContainText(/CLOSED|OPEN|No comment periods|Closed|Open/i);
});

test('decisions tab route is not routable on prod (recorded behaviour)', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });

  await page.goto(`/p/${project._id}/decisions`);
  await page.waitForURL(/\/projects$/, { timeout: 30_000 });

  expect(new URL(page.url()).pathname).toBe('/projects');
  expect(dialogs).toContain("Uh-oh, couldn't load project");
});

test('document download links resolve to /api/public/document/:id/download/:name', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const search = waitForSearch(page, 'Document', 'pageSize=10');
  await page.goto(`/p/${project._id}/documents`);
  const env = await search;
  await ready(page);

  // The row opens the download in a new tab; intercept the navigation instead of
  // letting the browser pull the file down.
  let captured = '';
  await page.context().route('**/api/public/document/**', async route => {
    captured = route.request().url();
    await route.abort();
  });
  await page.locator(ROWS).first().locator(NAME).click();
  await expect.poll(() => captured, { timeout: 20_000 }).toContain('/api/public/document/');

  const url = new URL(captured);
  expect(url.pathname).toMatch(new RegExp(`^/api/public/document/${env.searchResults[0]._id}/download/.+`));

  // HEAD, so the assertion costs a status line rather than the whole file.
  const head = await request.head(url.pathname);
  expect(head.status()).toBe(200);
  expect(Number(head.headers()['content-length'] ?? '1')).toBeGreaterThan(0);
});

test('@data project search API is scoped to the project', async ({ page, request }) => {
  const [project] = await twoProjects(request);
  const req = page.waitForRequest(r => r.url().includes('dataset=Document') && r.url().includes(`and[project]=${project._id}`));
  await page.goto(`/p/${project._id}/documents`);
  const wire = new URL((await req).url()).searchParams;
  expect(wire.get('and[project]')).toBe(project._id);
  expect(wire.get('pageSize')).toBe('10');

  const direct = await request.get((await req).url());
  expect(direct.status()).toBe(200);
  expect(total(unwrap(await direct.json()))).toBeGreaterThan(0);
});
