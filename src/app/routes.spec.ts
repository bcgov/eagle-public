import { describe, it, expect, afterEach } from 'vitest';
import { contentSearchLoader, routes } from './routes';
import { loadConfig } from './config/config';

async function configureWith(contentSearch: boolean): Promise<void> {
  window.__env = { logLevel: 4, CONTENT_SEARCH: contentSearch };
  await loadConfig();
}

function findRoute(path: string) {
  return routes[0].children?.find(route => route.path === path);
}

describe('contentSearchLoader', () => {
  const original = window.__env;

  afterEach(() => { window.__env = original; });

  it('sends /search/content to /search when content search is disabled', async () => {
    await configureWith(false);
    try {
      contentSearchLoader();
      expect.unreachable('loader should have redirected');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).headers.get('Location')).toBe('/search');
    }
  });

  it('allows /search/content when content search is enabled', async () => {
    await configureWith(true);
    expect(contentSearchLoader()).toBeNull();
  });

  it('guards the content search route', () => {
    expect(findRoute('search/content')?.loader).toBe(contentSearchLoader);
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
    const response = await (route!.loader as any)({ params: { projId: 'abc', commentPeriodId: 'def' } });
    expect(response.headers.get('Location')).toBe('/p/abc/cp/def/details');
  });

  it('gives the project route its top-level tabs plus an index redirect', () => {
    const project = findRoute('p/:projId');
    expect(project?.children?.map(child => child.path)).toEqual([
      undefined,
      'project-details',
      'commenting',
      'documents',
      'application',
      'certificates',
      'amendments',
      'decisions'
    ]);
  });

  it('nests the document-type tabs under documents', () => {
    const documents = findRoute('p/:projId')?.children?.find(child => child.path === 'documents');
    expect(documents?.children?.map(child => child.path)).toEqual([
      undefined,
      'application',
      'certificates',
      'amendments',
      'compliance'
    ]);
  });

  it.each(['application', 'certificates', 'amendments'])(
    'redirects the old top-level /%s path to its sub-tab, filters intact',
    async tab => {
      const route = findRoute('p/:projId')?.children?.find(
        child => child.path === tab && !!child.loader
      );
      const response = await (route!.loader as any)({
        params: { projId: 'abc' },
        request: new Request(`http://localhost/p/abc/${tab}?currentPage=2&sortBy=-datePosted`)
      });
      expect(response.headers.get('Location')).toBe(
        `/p/abc/documents/${tab}?currentPage=2&sortBy=-datePosted`
      );
    }
  );
});
