import type { LoaderFunctionArgs } from 'react-router';
import { hashToPath, legacySearchRedirect, resolveLegacySearch } from './legacy-search';

type LegacyLoader = ReturnType<typeof legacySearchRedirect>;

/** The address a legacy route's loader sends the reader to. */
function redirectTo(loader: LegacyLoader, from: string): string {
  const response = loader({
    request: new Request(`http://localhost${from}`),
  } as LoaderFunctionArgs);
  return response.headers.get('Location') ?? '';
}

/** The address a /search URL should be rewritten to, or null when it needs no rewrite. */
function resolved(from: string): string | null {
  const next = resolveLegacySearch(from);
  return next && next.pathname + next.search;
}

describe('legacySearchRedirect', () => {
  it.each([
    {
      name: 'the Angular project list, every filter carried over',
      loader: legacySearchRedirect('projects'),
      from:
        '/projects-list?keywords=coal&currentPage=2&pageSize=50&sortBy=-name' +
        '&type=Mines&eacDecision=Certificate+Issued&proponent=abc123&region=Cariboo' +
        '&CEAAInvolvement=Substituted&currentPhaseName=Application+Review' +
        '&decisionDateStart=2019-01-01&decisionDateEnd=2020-12-31',
      to:
        '/search?record=projects&keywords=coal&sortBy=-name&currentPage=2&pageSize=50' +
        '&type=Mines&eacDecision=Certificate+Issued&proponent=abc123&region=Cariboo' +
        '&CEAAInvolvement=Substituted&currentPhaseName=Application+Review' +
        '&decisionDateStart=2019-01-01&decisionDateEnd=2020-12-31',
    },
    {
      name: 'a bare project list',
      loader: legacySearchRedirect('projects'),
      from: '/projects-list',
      to: '/search?record=projects',
    },
    {
      name: 'the news page, keyword and paging carried over',
      loader: legacySearchRedirect('activities'),
      from: '/news?keywords=fish&currentPage=3&pageSize=10&sortBy=-dateAdded',
      to: '/search?record=activities&keywords=fish&sortBy=-dateAdded&currentPage=3&pageSize=10',
    },
    {
      name: 'project notifications, its four filters carried over',
      loader: legacySearchRedirect('notifications'),
      from: '/project-notifications?keywords=mine&type=Energy&region=Skeena&pcp=open&decision=Approved',
      to: '/search?record=notifications&keywords=mine&type=Energy&region=Skeena&pcp=open&decision=Approved',
    },
    {
      name: 'content search, which becomes the inside-documents scope',
      loader: legacySearchRedirect('documents', { scope: 'inside' }),
      from:
        '/search/content?keywords=tailings&currentPage=2&sortBy=-datePosted&dataset=Document' +
        '&milestone=m1&documentAuthorType=a1&type=t1&projectPhase=p1' +
        '&datePostedStart=2020-01-01&datePostedEnd=2021-01-01',
      to:
        '/search?record=documents&scope=inside&keywords=tailings&sortBy=-datePosted&currentPage=2' +
        '&milestone=m1&documentAuthorType=a1&type=t1&projectPhase=p1' +
        '&datePostedStart=2020-01-01&datePostedEnd=2021-01-01',
    },
    {
      name: 'a sort the record type cannot honour, which is dropped',
      loader: legacySearchRedirect('activities'),
      from: '/news?keywords=fish&sortBy=-datePosted',
      to: '/search?record=activities&keywords=fish',
    },
    {
      name: 'a param no page owns, which is dropped',
      loader: legacySearchRedirect('projects'),
      from: '/projects-list?keywords=coal&dataset=Project&ms=1&milestone=m1',
      to: '/search?record=projects&keywords=coal',
    },
    {
      name: 'a hash-router address, once the guard has turned it into a path',
      loader: legacySearchRedirect('projects'),
      from: hashToPath('#/projects-list?keywords=coal&sortBy=%2Bname') ?? '',
      to: '/search?record=projects&keywords=coal&sortBy=%2Bname',
    },
  ])('sends $name', ({ loader, from, to }) => {
    expect(redirectTo(loader, from)).toBe(to);
  });

  it('answers with a redirect response, not a rendered page', () => {
    const response = legacySearchRedirect('projects')({
      request: new Request('http://localhost/projects-list'),
    } as LoaderFunctionArgs);

    expect(response.status).toBe(302);
  });

  it('restores a sort sign the query string decoded to a space', () => {
    // `?sortBy=+name` arrives as `" name"`, which the API cannot sort by.
    expect(redirectTo(legacySearchRedirect('projects'), '/projects-list?sortBy=+name')).toBe(
      '/search?record=projects&sortBy=%2Bname',
    );
  });
});

describe('resolveLegacySearch', () => {
  it.each([
    {
      name: 'a document param means the Angular document search',
      from: '/search?keywords=pipeline&dataset=Document&milestone=m1&currentPage=2',
      to: '/search?record=documents&keywords=pipeline&currentPage=2&milestone=m1',
    },
    {
      name: 'dataset=Document alone is enough',
      from: '/search?dataset=Document&keywords=pipeline',
      to: '/search?record=documents&keywords=pipeline',
    },
    {
      name: 'a document filter alone is enough',
      from: '/search?keywords=pipeline&projectPhase=p1',
      to: '/search?record=documents&keywords=pipeline&projectPhase=p1',
    },
    {
      name: 'no document param means the default projects tab',
      from: '/search?keywords=pipeline',
      to: '/search?record=projects&keywords=pipeline',
    },
    {
      name: 'a bare /search still names its record type',
      from: '/search',
      to: '/search?record=projects',
    },
    {
      name: 'an unknown record type falls back to projects',
      from: '/search?record=bogus&keywords=pipeline',
      to: '/search?record=projects&keywords=pipeline',
    },
  ])('rewrites $name', ({ from, to }) => {
    expect(resolved(from)).toBe(to);
  });

  it.each([
    '/search?record=documents',
    '/search?record=projects&keywords=coal',
    '/search?record=documents&scope=inside&keywords=coal',
    '/search?record=notifications&pcp=open',
  ])('leaves %s alone, so the page does not redirect to itself', (from) => {
    expect(resolved(from)).toBeNull();
  });

  it('drops a sort the documents tab cannot honour', () => {
    expect(resolved('/search?dataset=Document&sortBy=-dateAdded')).toBe('/search?record=documents');
  });
});

describe('hashToPath', () => {
  it('turns an old hash address into a path', () => {
    expect(hashToPath('#/projects-list?keywords=coal')).toBe('/projects-list?keywords=coal');
  });

  it.each(['', '#main-content', '#top', '#'])('leaves the in-page anchor %s alone', (hash) => {
    expect(hashToPath(hash)).toBeNull();
  });

  it('refuses a protocol-relative hash, which would leave the site', () => {
    expect(hashToPath('#//evil.example.com/phish')).toBeNull();
  });
});
