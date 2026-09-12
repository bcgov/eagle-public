import { describe, it, expect } from 'vitest';
import { routes } from './routes';

function findRoute(path: string) {
  return routes[0].children?.find((route) => route.path === path);
}

describe('the legacy list routes', () => {
  it.each([
    ['projects-list', '/search?record=projects&keywords=coal&currentPage=2'],
    ['news', '/search?record=activities&keywords=coal&currentPage=2'],
    ['project-notifications', '/search?record=notifications&keywords=coal&currentPage=2'],
    ['search/content', '/search?record=documents&scope=inside&keywords=coal&currentPage=2'],
  ])('sends /%s to unified search before its old page renders', async (path, expected) => {
    const route = findRoute(path);
    const response = await (route!.loader as any)({
      request: new Request(`http://localhost/${path}?keywords=coal&currentPage=2`),
    });

    expect(response.headers.get('Location')).toBe(expected);
  });

  it('keeps the old page components mounted until the unified page lands', () => {
    expect(findRoute('projects-list')?.Component).toBeDefined();
    expect(findRoute('search/content')?.Component).toBeDefined();
  });

  it('leaves /search itself to its page', () => {
    expect(findRoute('search')?.loader).toBeUndefined();
  });
});

describe('routes', () => {
  it('redirects the wildcard route home', async () => {
    const wildcard = findRoute('*');
    expect(wildcard).toBeDefined();
    const response = await (wildcard!.loader as any)({});
    expect(response.headers.get('Location')).toBe('/');
  });

  it('redirects a bare comment period URL to its details page', async () => {
    const route = findRoute('p/:projId/cp/:commentPeriodId');
    const response = await (route!.loader as any)({
      params: { projId: 'abc', commentPeriodId: 'def' },
    });
    expect(response.headers.get('Location')).toBe('/p/abc/cp/def/details');
  });

  it('gives the project route its top-level tabs plus an index redirect', () => {
    const project = findRoute('p/:projId');
    expect(project?.children?.map((child) => child.path)).toEqual([
      undefined,
      'overview',
      'updates',
      'engagement',
      'documents',
      'application',
      'certificates',
      'amendments',
      'project-details',
      'commenting',
      'decisions',
      'compliance',
    ]);
  });

  it('sends a bare project URL to Overview', async () => {
    const index = findRoute('p/:projId')?.children?.find((child) => child.path === undefined);
    const response = await (index!.loader as any)({ params: { projId: 'abc' } });
    expect(response.headers.get('Location')).toBe('/p/abc/overview');
  });

  it('nests the document-type tabs under documents', () => {
    const documents = findRoute('p/:projId')?.children?.find((child) => child.path === 'documents');
    expect(documents?.children?.map((child) => child.path)).toEqual([
      undefined,
      'application',
      'certificates',
      'amendments',
      'compliance',
      'management-plans',
    ]);
  });

  it.each(['application', 'certificates', 'amendments'])(
    'redirects the old top-level /%s path to its sub-tab, filters intact',
    async (tab) => {
      const route = findRoute('p/:projId')?.children?.find(
        (child) => child.path === tab && !!child.loader,
      );
      const response = await (route!.loader as any)({
        params: { projId: 'abc' },
        request: new Request(`http://localhost/p/abc/${tab}?currentPage=2&sortBy=-datePosted`),
      });
      expect(response.headers.get('Location')).toBe(
        `/p/abc/documents/${tab}?currentPage=2&sortBy=-datePosted`,
      );
    },
  );

  it.each([
    ['project-details', 'overview'],
    ['commenting', 'engagement'],
  ])('redirects the renamed /%s path to /%s, search intact', async (from, to) => {
    const route = findRoute('p/:projId')?.children?.find((child) => child.path === from);
    const response = await (route!.loader as any)({
      params: { projId: 'abc' },
      request: new Request(`http://localhost/p/abc/${from}?search=fish`),
    });
    expect(response.headers.get('Location')).toBe(`/p/abc/${to}?search=fish`);
  });
});
