import { describe, it, expect, afterEach, vi } from 'vitest';
import { json, native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { Document } from 'app/models/document';
import { queryClient } from './query-client';
import { documentFilters, fromNativeDocument, getByMultiId, readDocuments } from './document';

const ROW = {
  id: 'doc-1',
  projectId: 'track-26',
  projectEagleId: 'eagle-1',
  displayName: 'Certificate',
  documentFileName: 'cert.pdf',
  type: 'Certificate Package',
  typeId: 'type-cert',
  milestone: 'Certificate',
  milestoneId: 'ms-cert',
  projectPhase: 'Post Decision',
  projectPhaseId: 'ph-post',
  documentAuthorType: 'EAO',
  documentAuthorTypeId: 'author-eao',
  fileSize: 2048,
  mimeType: 'application/pdf',
  datePosted: '2026-05-01T07:00:00.000Z',
  isFeatured: true,
};

/** A project DEMI holds under Track id `track-26`; any other id is a notification's. */
function stubDocuments(rows: unknown[] = [], total = rows.length): string[] {
  return stubFetch((url) => {
    if (url === '/demi-projects/eagle-1') return json({ id: 'track-26', eagleId: 'eagle-1' });
    if (url.startsWith('/demi-projects/')) return json(null, 404);
    if (url.startsWith('/demi/api/documents')) return native(rows, total);
    return undefined;
  });
}

const documentRequests = (requests: string[]) =>
  requests.filter((url) => url.startsWith('/demi/api/documents'));

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe('fromNativeDocument', () => {
  it('keys the row by id, links it to the Eagle project, and keeps List ids where pages look names up', () => {
    const document = fromNativeDocument(ROW);

    expect(document).toBeInstanceOf(Document);
    expect(document).toMatchObject({
      _id: 'doc-1',
      project: 'eagle-1',
      type: 'type-cert',
      milestone: 'ms-cert',
      projectPhase: 'ph-post',
      documentAuthorType: 'author-eao',
      internalSize: '2048',
      internalMime: 'application/pdf',
      internalOriginalName: 'cert.pdf',
      isFeatured: true,
    });
  });

  it('falls back to the display name for the attachment label, and leaves an unknown size unset', () => {
    const document = fromNativeDocument({ id: 'doc-2', displayName: 'Letter', fileSize: null });

    expect(document.internalOriginalName).toBe('Letter');
    expect(document.internalSize).toBeUndefined();
  });
});

describe('documentFilters', () => {
  it('renames List filters to their native ids and splits comma-joined values', () => {
    expect(
      documentFilters({
        type: 'a,b',
        milestone: 'm',
        projectPhase: 'p',
        documentAuthorType: 'x',
        documentSource: 'PROJECT',
      }),
    ).toEqual({
      typeId: ['a', 'b'],
      milestoneId: ['m'],
      projectPhaseId: ['p'],
      documentAuthorTypeId: ['x'],
      documentSource: ['PROJECT'],
    });
  });

  it('sends the posted-date range as days', () => {
    expect(
      documentFilters({
        datePostedStart: '2024-01-01T00:00:00.000Z',
        datePostedEnd: '2024-12-31T00:00:00.000Z',
      }),
    ).toEqual({ datePostedStart: ['2024-01-01'], datePostedEnd: ['2024-12-31'] });
  });

  it('keeps only the values both sets allow when two narrow the same field, and skips empty ones', () => {
    expect(
      documentFilters({ type: 'a,b', milestone: '' }, { type: 'b,c', projectPhase: null }),
    ).toEqual({
      typeId: ['b'],
    });
  });
});

describe('readDocuments', () => {
  it("reads a project's documents under its DEMI id, counted, with native sort and filters", async () => {
    const requests = stubDocuments([ROW], 42);

    const page = await readDocuments({
      projId: 'eagle-1',
      page: 3,
      pageSize: 25,
      sortBy: '+displayName',
      filters: { typeId: ['a', 'b'] },
    });

    expect(documentRequests(requests)).toEqual([
      '/demi/api/documents?page=3&pageSize=25&count=true&sort=displayName&typeId=a&typeId=b&project=track-26',
    ]);
    expect(page.total).toBe(42);
    expect(page.rows[0]).toMatchObject({ _id: 'doc-1', type: 'type-cert' });
  });

  it("reads a notification's documents under the notification's own id", async () => {
    const requests = stubDocuments();

    await readDocuments({ projId: 'notification-1', page: 1, pageSize: 10, sortBy: '-datePosted' });

    expect(documentRequests(requests)).toEqual([
      '/demi/api/documents?page=1&pageSize=10&count=true&sort=-datePosted&project=notification-1',
    ]);
  });

  it('leaves a keyword search in best-match order, and sends the keywords as q', async () => {
    const requests = stubDocuments();

    await readDocuments({
      projId: 'eagle-1',
      page: 1,
      pageSize: 10,
      sortBy: '-score',
      keywords: ' water ',
    });

    expect(documentRequests(requests)).toEqual([
      '/demi/api/documents?page=1&pageSize=10&count=true&q=water&project=track-26',
    ]);
  });

  it('falls back to newest first for a column DEMI cannot sort, and caps the page at 100', async () => {
    const requests = stubDocuments();

    await readDocuments({ projId: 'eagle-1', page: 1, pageSize: 500, sortBy: '+type' });

    expect(documentRequests(requests)).toEqual([
      '/demi/api/documents?page=1&pageSize=100&count=true&sort=-datePosted&project=track-26',
    ]);
  });

  it('sends no sort for a count, which asks for none', async () => {
    const requests = stubDocuments([], 7);

    const { total } = await readDocuments({ projId: 'eagle-1', page: 1, pageSize: 1 });

    expect(documentRequests(requests)).toEqual([
      '/demi/api/documents?page=1&pageSize=1&count=true&project=track-26',
    ]);
    expect(total).toBe(7);
  });

  it('throws when DEMI refuses the read, so the caller can tell it from no documents', async () => {
    stubFetch((url) => (url.startsWith('/demi/api/documents') ? json(null, 400) : json(null, 404)));

    await expect(readDocuments({ projId: 'eagle-1', page: 1, pageSize: 1 })).rejects.toThrow();
  });
});

describe('getByMultiId', () => {
  it('reads the documents by id from DEMI, in the order asked', async () => {
    const requests = stubDocuments([
      { ...ROW, id: 'b' },
      { ...ROW, id: 'a' },
    ]);

    const documents = await getByMultiId(['a', 'b']);

    expect(documentRequests(requests)).toEqual(['/demi/api/documents?pageSize=2&ids=a,b']);
    expect(documents.map((document) => document._id)).toEqual(['a', 'b']);
    expect(documents[0]).toBeInstanceOf(Document);
  });

  it('asks nothing for no ids', async () => {
    const requests = stubDocuments();

    expect(await getByMultiId([])).toEqual([]);
    expect(requests).toEqual([]);
  });
});
