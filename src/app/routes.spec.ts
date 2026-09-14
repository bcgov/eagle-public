import { describe, it, expect } from 'vitest';
import { routes, searchLoader } from './routes';

function findRoute(path: string) {
  return routes[0].children?.find((route) => route.path === path);
}

async function loaderLocation(path: string, url: string): Promise<string | null> {
  const response = await (findRoute(path)!.loader as any)({ request: new Request(url) });
  return response ? response.headers.get('Location') : null;
}

describe('the legacy list routes', () => {
  it.each([
    {
      path: 'projects-list',
      from: 'http://localhost/projects-list?keywords=coal&currentPage=2',
      to: '/search?record=projects&keywords=coal&currentPage=2',
    },
    {
      path: 'news',
      from: 'http://localhost/news?keywords=fish&currentPage=2',
      to: '/search?record=activities&keywords=fish&currentPage=2',
    },
    {
      path: 'project-notifications',
      from: 'http://localhost/project-notifications?keywords=mine&pcp=open&region=Skeena',
      to: '/search?record=notifications&keywords=mine&region=Skeena&pcp=open',
    },
    {
      path: 'search/content',
      from: 'http://localhost/search/content?keywords=water&currentPage=3&pageSize=10&sortBy=-score',
      to: '/search?record=documents&scope=inside&keywords=water&currentPage=3&pageSize=10',
    },
  ])(
    'sends /$path to unified search instead of rendering a page of its own',
    async ({ path, from, to }) => {
      expect(await loaderLocation(path, from)).toBe(to);
      expect(findRoute(path)?.Component).toBeUndefined();
    },
  );
});

describe('searchLoader', () => {
  it('reads an Angular /search as documents when it carries a document param', async () => {
    expect(
      await loaderLocation('search', 'http://localhost/search?keywords=coal&milestone=m1'),
    ).toBe('/search?record=documents&keywords=coal&milestone=m1');
  });

  it('reads an Angular /search with no document param as documents, the tab it opens on', async () => {
    expect(await loaderLocation('search', 'http://localhost/search?keywords=coal')).toBe(
      '/search?record=documents&keywords=coal',
    );
  });

  it('leaves a new-style /search address to the page', async () => {
    expect(
      await searchLoader({
        request: new Request('http://localhost/search?record=documents&keywords=coal'),
      } as any),
    ).toBeNull();
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
