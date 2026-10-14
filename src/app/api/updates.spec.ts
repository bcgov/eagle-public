import { createElement, type ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { json, native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { makeQueryClient } from '../../test-utils';
import { logger } from 'app/config/logging';
import { queryClient } from './query-client';
import {
  filterUpdates,
  isVisibleUpdate,
  projectUpdatesQueryOptions,
  SUMMARY_MAX,
  toUpdate,
  type UpdateRefs,
} from './updates';

describe('isVisibleUpdate', () => {
  it('shows published updates and rows older than status', () => {
    expect(isVisibleUpdate({ status: 'published' })).toBe(true);
    expect(isVisibleUpdate({})).toBe(true);
  });

  it('hides drafts and archived updates', () => {
    expect(isVisibleUpdate({ status: 'draft' })).toBe(false);
    expect(isVisibleUpdate({ status: 'archived' })).toBe(false);
  });

  it('leaves the publish date to demi-search rather than the browser clock', () => {
    const row = { status: 'published', publishDate: '2999-01-01T00:00:00Z' };

    expect(isVisibleUpdate(row)).toBe(true);
  });
});

describe('toUpdate summary', () => {
  const words = (count: number) => Array.from({ length: count }, () => 'caribou').join(' ');

  it('cuts a long fallback at a word boundary, with an ellipsis, inside the limit', () => {
    const { summary } = toUpdate({ content: `<p>${words(60)}</p>` });

    expect(summary.length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(summary).toMatch(/ caribou…$/);
  });

  it('caps and trims an entered summary the same way', () => {
    const { summary } = toUpdate({ summary: `  ${words(60)}  ` });

    expect(summary.length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(summary).toMatch(/^caribou .* caribou…$/);
  });

  it('keeps a short entered summary as written, trimmed', () => {
    expect(toUpdate({ summary: '  Have your say.  ' }).summary).toBe('Have your say.');
  });

  it('falls back to the leading block even when it is not a paragraph', () => {
    const { summary } = toUpdate({ content: '<div>Lead text.</div><p>Second block.</p>' });

    expect(summary).toBe('Lead text.');
  });

  it('falls back to bare text written before any block', () => {
    const { summary } = toUpdate({
      content: 'Bare <strong>lead</strong> text.<p>Second block.</p>',
    });

    expect(summary).toBe('Bare lead text.');
  });

  it('skips empty leading blocks to the first one with text', () => {
    const { summary } = toUpdate({ content: '<p></p><div>&nbsp;</div><p>First words.</p>' });

    expect(summary).toBe('First words.');
  });
});

/** Refs in which the caller may read each of `ids`, unnamed. */
function readable(...ids: string[]): UpdateRefs {
  return { documents: new Map(ids.map((id) => [id, { id }])), periods: new Map() };
}

describe('toUpdate attachments', () => {
  it('uses the document name, and numbers only the unnamed ones', () => {
    const refs = readable('doc-2', 'doc-3');
    const documents = new Map([...refs.documents, ['doc-1', { displayName: 'Notice.pdf' }]]);

    const { attachments } = toUpdate(
      { attachments: [null, 'doc-1', '', 'doc-2', 'doc-3'] },
      { ...refs, documents },
    );

    expect(attachments.map((doc) => doc.name)).toEqual(['Notice.pdf', 'Document 1', 'Document 2']);
  });

  it('lists a file attached twice once', () => {
    const { attachments } = toUpdate({ attachments: ['doc-1', 'doc-1'] }, readable('doc-1'));

    expect(attachments.map((doc) => doc.id)).toEqual(['doc-1']);
  });

  it('leaves out a document the caller may not read', () => {
    const { attachments } = toUpdate({ attachments: ['doc-1', 'doc-2'] }, readable('doc-2'));

    expect(attachments.map((doc) => doc.id)).toEqual(['doc-2']);
  });

  it('takes the location from the project address when the update has none', () => {
    const refs = { ...readable(), address: 'Kitimat' };

    expect(toUpdate({}, refs).location).toBe('Kitimat');
    expect(toUpdate({ location: 'Terrace' }, refs).location).toBe('Terrace');
  });
});

describe('toUpdate comment period', () => {
  const refs: UpdateRefs = {
    ...readable(),
    periods: new Map([['cp1', { isMet: true, metURL: 'https://engage.eao.gov.bc.ca/cedar' }]]),
  };

  it('links the period the update names, with its ENGAGE fields', () => {
    expect(toUpdate({ pcp: 'cp1' }, refs).commentPeriod).toEqual({
      id: 'cp1',
      isMet: true,
      metURL: 'https://engage.eao.gov.bc.ca/cedar',
    });
  });

  it('links no period the caller may not read', () => {
    expect(toUpdate({ pcp: 'cp-hidden' }, refs).commentPeriod).toBeNull();
  });
});

describe('toUpdate images', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the editor order and drops rows with no readable document', () => {
    const { images } = toUpdate(
      {
        images: [
          { document: 'img-b', alt: 'B' },
          { document: null, alt: 'Gone' },
          { document: 'img-a', alt: 'A' },
          { document: '', alt: 'Empty' },
          { document: 'img-hidden', alt: 'Hidden' },
        ],
      },
      readable('img-a', 'img-b'),
    );

    expect(images.map((image) => image.id)).toEqual(['img-b', 'img-a']);
  });

  it('stops at five photos, counting only the usable ones', () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7'].map((n) => `img-${n}`);
    const { images } = toUpdate(
      { images: [{ document: null }, ...ids.map((id) => ({ document: id, alt: id }))] },
      readable(...ids),
    );

    expect(images.map((image) => image.id)).toEqual(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']);
  });

  it('trims caption and credit, and turns blank ones into null', () => {
    const { images } = toUpdate(
      {
        images: [
          { document: 'img-1', alt: 'A', caption: '  The intake  ', credit: ' EAO staff ' },
          { document: 'img-2', alt: 'B', caption: '   ', credit: null },
        ],
      },
      readable('img-1', 'img-2'),
    );

    expect(images[0]).toMatchObject({ caption: 'The intake', credit: 'EAO staff' });
    expect(images[1]).toMatchObject({ caption: null, credit: null });
  });

  it('trims alt text and warns when a photo has none', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { images } = toUpdate(
      {
        images: [
          { document: 'img-1', alt: '  The river  ' },
          { document: 'img-2', alt: '   ' },
          { document: 'img-3' },
        ],
      },
      readable('img-1', 'img-2', 'img-3'),
    );

    expect(images.map((image) => image.alt)).toEqual(['The river', '', '']);
    expect(warn.mock.calls.map((call) => call[2])).toEqual(['img-2', 'img-3']);
  });

  it('encodes the id into the download address and keeps it raw as the id', () => {
    const { images } = toUpdate(
      { images: [{ document: 'a/b c?d', alt: 'A' }] },
      readable('a/b c?d'),
    );

    expect(images[0].id).toBe('a/b c?d');
    expect(images[0].src).toMatch(/\/documents\/a%2Fb%20c%3Fd\/download\?redirect=1$/);
  });

  it('gives the featured image its caption and credit, and null when it has no document', () => {
    const refs = readable('img-9');

    expect(
      toUpdate(
        { featuredImage: { document: 'img-9', alt: 'Site', caption: 'Site', credit: 'EAO' } },
        refs,
      ).featuredImage,
    ).toMatchObject({ id: 'img-9', alt: 'Site', caption: 'Site', credit: 'EAO' });
    expect(
      toUpdate({ featuredImage: { document: null, alt: 'Site' } }, refs).featuredImage,
    ).toBeNull();
    expect(toUpdate({ featuredImage: null }, refs).featuredImage).toBeNull();
  });

  it('reads a row without images as an empty series', () => {
    expect(toUpdate({ images: null }).images).toEqual([]);
    expect(toUpdate({}).images).toEqual([]);
  });
});

describe('filterUpdates', () => {
  const updates = [
    toUpdate({ id: 'a', headline: 'Water licence issued', content: '<p>For the intake.</p>' }),
    toUpdate({ id: 'b', headline: 'Road closure', shortHeadline: 'Closure on Hwy 16' }),
    toUpdate({
      id: 'c',
      headline: 'Report',
      summary: 'Summary about caribou.',
      content: '<p>Intro.</p><p>Details on <b>salmon</b> habitat.</p>',
    }),
  ];
  const ids = (text: string) => filterUpdates(updates, text).map((update) => update.id);

  it('matches the headline and short headline, ignoring case', () => {
    expect(ids('WATER')).toEqual(['a']);
    expect(ids('hwy')).toEqual(['b']);
  });

  it('matches the summary and the body text, past its first paragraph', () => {
    expect(ids('caribou')).toEqual(['c']);
    expect(ids('salmon habitat')).toEqual(['c']);
  });

  it('keeps everything for an empty filter', () => {
    expect(ids('  ')).toEqual(['a', 'b', 'c']);
  });
});

describe('projectUpdatesQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // The period and project reads go through the app's own cache.
    queryClient.clear();
  });

  const rows = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `u${from + index}`,
      headline: `Update ${from + index}`,
      dateAdded: new Date(Date.UTC(2026, 0, 1) + (from + index) * 60_000).toISOString(),
    }));
  const updateReads = (requests: string[]) =>
    requests.filter((url) => url.startsWith('/demi/api/updates?'));
  const pageOf = (url: string) => Number(/[?&]page=(\d+)/.exec(url)?.[1]);

  it('asks for the project by its Eagle id, newest published first, counted', async () => {
    const requests = stubFetch(() => undefined);

    await projectUpdatesQueryOptions('eagle-1').queryFn();

    expect(updateReads(requests)).toEqual([
      '/demi/api/updates?page=1&pageSize=100&count=true&sort=-publishDate&project=eagle-1',
    ]);
  });

  it('pages through every update DEMI counts', async () => {
    const requests = stubFetch((url) => {
      if (!url.startsWith('/demi/api/updates?')) return undefined;
      const page = pageOf(url);
      return native(page === 1 ? rows(0, 100) : page === 2 ? rows(100, 60) : [], 160);
    });

    const updates = await projectUpdatesQueryOptions('proj-1').queryFn();

    expect(updates).toHaveLength(160);
    expect(updates[0].id).toBe('u159');
    expect(updateReads(requests).map(pageOf)).toEqual([1, 2]);
  });

  it('keeps one copy of a row that shifted onto the next page between reads', async () => {
    stubFetch((url) => {
      if (!url.startsWith('/demi/api/updates?')) return undefined;
      // A new row landed after page one was read, pushing u99 onto page two as well.
      const page = pageOf(url);
      return native(page === 1 ? rows(0, 100) : page === 2 ? rows(99, 61) : [], 161);
    });

    const updates = await projectUpdatesQueryOptions('proj-1').queryFn();

    expect(updates.filter((update) => update.id === 'u99')).toHaveLength(1);
    expect(updates).toHaveLength(160);
  });

  it('stops paging on an empty page even when the count says more', async () => {
    const requests = stubFetch((url) => {
      if (!url.startsWith('/demi/api/updates?')) return undefined;
      return native(pageOf(url) === 1 ? rows(0, 3) : [], 900);
    });

    const updates = await projectUpdatesQueryOptions('proj-1').queryFn();

    expect(updates).toHaveLength(3);
    expect(updateReads(requests)).toHaveLength(2);
  });

  it('names attachments from their documents, and links the period from the project', async () => {
    const requests = stubFetch((url) => {
      if (url.startsWith('/demi/api/updates?')) {
        return native([
          { id: 'u1', attachments: ['doc-1', 'doc-hidden'], pcp: 'cp1' },
          { id: 'u2', attachments: ['doc-1'] },
        ]);
      }
      if (url === '/demi/api/documents/doc-1')
        return json({ id: 'doc-1', displayName: 'Notice.pdf' });
      if (url.startsWith('/demi/api/documents/')) return json(null, 404);
      if (url.startsWith('/demi-projects/')) return json({ id: 'track-1', address: 'Kitimat' });
      if (url.startsWith('/demi/api/comment-periods?')) {
        return native([{ id: 'cp1', isMet: true, metURL: 'https://engage.eao.gov.bc.ca/c' }]);
      }
      return undefined;
    });

    const [update] = await projectUpdatesQueryOptions('eagle-1').queryFn();

    expect(update.attachments.map((doc) => doc.name)).toEqual(['Notice.pdf']);
    expect(update.commentPeriod).toEqual({
      id: 'cp1',
      isMet: true,
      metURL: 'https://engage.eao.gov.bc.ca/c',
    });
    expect(update.location).toBe('Kitimat');
    // One read per document, however many updates attach it.
    expect(requests.filter((url) => url.startsWith('/demi/api/documents/')).sort()).toEqual([
      '/demi/api/documents/doc-1',
      '/demi/api/documents/doc-hidden',
    ]);
  });

  it('leaves out a document whose read fails, and still answers every update', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    stubFetch((url) => {
      if (url.startsWith('/demi/api/updates?')) {
        return native([{ id: 'u1' }, { id: 'u2', attachments: ['doc-1'] }]);
      }
      if (url === '/demi/api/documents/doc-1') return json(null, 500);
      return undefined;
    });

    const updates = await projectUpdatesQueryOptions('eagle-1').queryFn();

    expect(updates.map((update) => update.id).sort()).toEqual(['u1', 'u2']);
    expect(updates.find((update) => update.id === 'u2')?.attachments).toEqual([]);
  });

  it('reads no documents or periods when no update references any', async () => {
    const requests = stubFetch((url) =>
      url.startsWith('/demi/api/updates?') ? native(rows(0, 2)) : undefined,
    );

    await projectUpdatesQueryOptions('eagle-1').queryFn();

    expect(requests.filter((url) => /\/demi\/api\/(documents|comment-periods)/.test(url))).toEqual(
      [],
    );
  });

  it('shows a failed read at once, after one request, even where retries are on', async () => {
    const requests = stubFetch(() => json(null, 500));
    const client = makeQueryClient({ retry: 3 });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useQuery(projectUpdatesQueryOptions('proj-1')), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requests).toHaveLength(1);
  });
});
