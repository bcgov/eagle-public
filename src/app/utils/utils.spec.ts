import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { Constants } from './constants';
import { loadConfig } from 'app/config/config';
import {
  createProjectTabModifiers,
  documentDownloadUrl,
  extractFromSearchResults,
  openDocumentDownload,
  triggerDownload,
} from './utils';

/** The src of every download iframe currently in the document. */
function downloadUrls(): string[] {
  return [...document.body.querySelectorAll('iframe')].map(
    (frame) => frame.getAttribute('src') ?? '',
  );
}

describe('extractFromSearchResults()', () => {
  // The Array.isArray guard never covered an empty array, so `results[0].data` threw a
  // TypeError. demi-api can answer 2xx with no result envelope, which lands here as [].
  it('returns null for an empty array instead of throwing', () => {
    expect(() => extractFromSearchResults([])).not.toThrow();
    expect(extractFromSearchResults([])).toBeNull();
  });

  it('returns null for a null response', () => {
    expect(extractFromSearchResults(null as any)).toBeNull();
  });

  it('returns null when the envelope carries no data', () => {
    expect(extractFromSearchResults([{} as any])).toBeNull();
  });

  it('still returns the search results for a well-formed response', () => {
    const results = extractFromSearchResults([
      { data: { searchResults: [{ _id: 'abc' }] } } as any,
    ]);
    expect(results).toEqual([{ _id: 'abc' }]);
  });

  it('returns null, not undefined, for a data-bearing envelope with no searchResults', () => {
    // The declared return type is `T[] | null`. Without the `?? null` this returned `undefined`
    // and the `as T[]` cast made every caller's type wrong about it.
    expect(extractFromSearchResults([{ data: { meta: [] } }] as any)).toBeNull();
  });
});

describe('createProjectTabModifiers()', () => {
  const LISTS = [
    { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
    { _id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },
    { _id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
    { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
    {
      _id: 'ph-amend-2002',
      name: 'Post Decision - Amendment',
      legislation: 2002,
      type: 'projectPhase',
    },
  ];

  it('selects compliance documents by milestone alone', () => {
    expect(createProjectTabModifiers(Constants.optionalProjectDocTabs.COMPLIANCE, LISTS)).toEqual({
      documentSource: 'PROJECT',
      milestone: 'ms-ce-2002,ms-ce-2018',
    });
  });

  it('omits a field it has no ids for rather than sending it empty', () => {
    // api.searchKeywords turns '' into `&and[type]=`, and eagle-api answers that with nothing at
    // all, so an empty value silently empties the tab.
    const modifiers = createProjectTabModifiers(
      Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC,
      LISTS,
    );
    expect(modifiers).toEqual({ documentSource: 'PROJECT' });
  });

  it('still sends type, milestone and phase for the amendment tab', () => {
    expect(createProjectTabModifiers(Constants.optionalProjectDocTabs.AMENDMENT, LISTS)).toEqual({
      documentSource: 'PROJECT',
      type: 'type-amend-2002',
      milestone: 'ms-amend-2002',
      projectPhase: 'ph-amend-2002',
    });
  });
});

/**
 * A presigned URL can answer with an error - an object-store 404 XML - and a top-level navigation
 * to that unmounts the whole app. A hidden iframe renders the error where nobody sees it.
 */
describe('triggerDownload()', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    document.body.querySelectorAll('iframe').forEach((frame) => frame.remove());
  });

  it('loads the url in a hidden iframe rather than navigating the page', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    triggerDownload('https://nrs.example/one.pdf');

    expect(downloadUrls()).toEqual(['https://nrs.example/one.pdf']);
    expect(document.body.querySelector('iframe')?.hidden).toBe(true);
    expect(click).not.toHaveBeenCalled();
  });

  it('removes the iframe once the download has had time to start', () => {
    triggerDownload('https://nrs.example/one.pdf');

    vi.advanceTimersByTime(60_000);

    expect(downloadUrls()).toEqual([]);
  });
});

/**
 * A single download goes through demi-api for a presigned, forced-attachment URL and starts in a
 * hidden iframe. With no DEMI configured, or when DEMI does not answer with a URL, it falls back to
 * the eagle-api URL, which is also the anchor href.
 */
describe('openDocumentDownload()', () => {
  const originalEnv = window.__env;
  const DOCUMENT = {
    _id: 'doc-1',
    documentFileName: 'Fish Habitat.pdf',
    displayName: 'Fish Habitat',
  };
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
  });

  afterEach(() => {
    window.__env = originalEnv;
    document.body.querySelectorAll('iframe').forEach((frame) => frame.remove());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function configuredWith(searchApiPath: string): Promise<void> {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: searchApiPath };
    await loadConfig();
  }

  it('builds the eagle-api download URL from the file name', () => {
    expect(documentDownloadUrl(DOCUMENT)).toBe(
      '/api/public/document/doc-1/download/Fish%20Habitat.pdf',
    );
  });

  it('starts the presigned download when DEMI is configured', async () => {
    await configuredWith('/demi-search');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ url: 'https://nrs.example/zip?sig=abc', single: true })),
    );

    openDocumentDownload(DOCUMENT);

    await waitFor(() => expect(downloadUrls()).toEqual(['https://nrs.example/zip?sig=abc']));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens the eagle-api URL when no search backend is configured', async () => {
    await configuredWith('');

    openDocumentDownload(DOCUMENT);

    expect(openSpy).toHaveBeenCalledWith(
      '/api/public/document/doc-1/download/Fish%20Habitat.pdf',
      '_blank',
    );
  });

  // The deployed hosts do not route /demi-search/bulk-downloads; the file still has to arrive.
  it('falls back to the eagle-api URL when demi-api refuses the POST', async () => {
    await configuredWith('/demi-search');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 405, statusText: 'Not Allowed' })),
    );

    expect(() => openDocumentDownload(DOCUMENT)).not.toThrow();

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        '/api/public/document/doc-1/download/Fish%20Habitat.pdf',
        '_blank',
      ),
    );
    expect(downloadUrls()).toEqual([]);
  });

  it('falls back to the eagle-api URL when the POST answers a job instead of a url', async () => {
    await configuredWith('/demi-search');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ id: 'job-1', status: 'queued', documentCount: 1 }, { status: 202 }),
      ),
    );

    openDocumentDownload(DOCUMENT);

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        '/api/public/document/doc-1/download/Fish%20Habitat.pdf',
        '_blank',
      ),
    );
    expect(downloadUrls()).toEqual([]);
  });

  it('falls back to the eagle-api URL when the POST answers with HTML', async () => {
    await configuredWith('/demi-search');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!doctype html>', { status: 200 })),
    );

    openDocumentDownload(DOCUMENT);

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        '/api/public/document/doc-1/download/Fish%20Habitat.pdf',
        '_blank',
      ),
    );
    expect(downloadUrls()).toEqual([]);
  });
});
