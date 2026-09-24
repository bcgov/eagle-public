import { describe, it, expect, afterEach, vi } from 'vitest';
import { json, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { logger } from 'app/config/logging';
import {
  filterUpdates,
  isVisibleUpdate,
  projectUpdatesQueryOptions,
  SUMMARY_MAX,
  toUpdate,
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
});

describe('toUpdate attachments', () => {
  it('uses the name demi-search resolves, and numbers unnamed ones after dropping empty refs', () => {
    const { attachments } = toUpdate({
      attachments: [null, { _id: 'doc-1', displayName: 'Notice.pdf' }, '', 'doc-2'],
    });

    expect(attachments.map((doc) => doc.name)).toEqual(['Notice.pdf', 'Document 2']);
  });

  it('takes the location from the project when the update has none', () => {
    expect(toUpdate({ project: { _id: 'p1', location: 'Kitimat' } }).location).toBe('Kitimat');
  });
});

describe('toUpdate images', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the editor order and drops rows with no document', () => {
    const { images } = toUpdate({
      images: [
        { document: 'img-b', alt: 'B' },
        { document: null, alt: 'Gone' },
        { document: { _id: 'img-a' }, alt: 'A' },
        { document: '', alt: 'Empty' },
      ],
    });

    expect(images.map((image) => image.id)).toEqual(['img-b', 'img-a']);
  });

  it('stops at five photos, counting only the usable ones', () => {
    const { images } = toUpdate({
      images: [
        { document: null },
        ...['1', '2', '3', '4', '5', '6', '7'].map((n) => ({
          document: `img-${n}`,
          alt: `Photo ${n}`,
        })),
      ],
    });

    expect(images.map((image) => image.id)).toEqual(['img-1', 'img-2', 'img-3', 'img-4', 'img-5']);
  });

  it('trims caption and credit, and turns blank ones into null', () => {
    const { images } = toUpdate({
      images: [
        { document: 'img-1', alt: 'A', caption: '  The intake  ', credit: ' EAO staff ' },
        { document: 'img-2', alt: 'B', caption: '   ', credit: null },
      ],
    });

    expect(images[0]).toMatchObject({ caption: 'The intake', credit: 'EAO staff' });
    expect(images[1]).toMatchObject({ caption: null, credit: null });
  });

  it('trims alt text and warns when a photo has none', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { images } = toUpdate({
      images: [
        { document: 'img-1', alt: '  The river  ' },
        { document: 'img-2', alt: '   ' },
        { document: 'img-3' },
      ],
    });

    expect(images.map((image) => image.alt)).toEqual(['The river', '', '']);
    expect(warn.mock.calls.map((call) => call[2])).toEqual(['img-2', 'img-3']);
  });

  it('encodes the id into the download address and keeps it raw as the id', () => {
    const { images } = toUpdate({ images: [{ document: 'a/b c?d', alt: 'A' }] });

    expect(images[0].id).toBe('a/b c?d');
    expect(images[0].src).toMatch(/\/documents\/a%2Fb%20c%3Fd\/download\?redirect=1$/);
  });

  it('gives the featured image its caption and credit, and null when it has no document', () => {
    expect(
      toUpdate({
        featuredImage: { document: 'img-9', alt: 'Site', caption: 'Site', credit: 'EAO' },
      }).featuredImage,
    ).toMatchObject({ id: 'img-9', alt: 'Site', caption: 'Site', credit: 'EAO' });
    expect(toUpdate({ featuredImage: { document: null, alt: 'Site' } }).featuredImage).toBeNull();
    expect(toUpdate({ featuredImage: null }).featuredImage).toBeNull();
  });

  it('reads a row without images as an empty series', () => {
    expect(toUpdate({ images: null }).images).toEqual([]);
    expect(toUpdate({}).images).toEqual([]);
  });
});

describe('filterUpdates', () => {
  const updates = [
    toUpdate({ _id: 'a', headline: 'Water licence issued', content: '<p>For the intake.</p>' }),
    toUpdate({ _id: 'b', headline: 'Road closure', shortHeadline: 'Closure on Hwy 16' }),
    toUpdate({
      _id: 'c',
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
  afterEach(() => vi.unstubAllGlobals());

  const rows = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      _id: `u${from + index}`,
      headline: `Update ${from + index}`,
      dateAdded: new Date(Date.UTC(2026, 0, 1) + (from + index) * 60_000).toISOString(),
    }));

  it('pages through every update demi-search counts, asking newest published first', async () => {
    const total = 260;
    const requests = stubFetch((url) => {
      const page = Number(/pageNum=(\d+)/.exec(url)?.[1]);
      const pageRows = page === 0 ? rows(0, 250) : page === 1 ? rows(250, 10) : [];
      return json([{ searchResults: pageRows, meta: [{ searchResultsTotal: total }] }]);
    });

    const updates = await projectUpdatesQueryOptions('proj-1').queryFn();

    expect(updates).toHaveLength(total);
    expect(updates[0].id).toBe('u259');
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain('sortBy=-publishDate');
  });

  it('keeps one copy of a row that shifted onto the next page between reads', async () => {
    stubFetch((url) => {
      const page = Number(/pageNum=(\d+)/.exec(url)?.[1]);
      // A new row landed after page one was read, pushing u249 onto page two as well.
      const pageRows = page === 0 ? rows(0, 250) : page === 1 ? rows(249, 11) : [];
      return json([{ searchResults: pageRows, meta: [{ searchResultsTotal: 261 }] }]);
    });

    const updates = await projectUpdatesQueryOptions('proj-1').queryFn();

    expect(updates.filter((update) => update.id === 'u249')).toHaveLength(1);
    expect(updates).toHaveLength(260);
  });

  it('stops paging on an empty page even when the count says more', async () => {
    const requests = stubFetch((url) => {
      const first = url.includes('pageNum=0');
      return json([
        { searchResults: first ? rows(0, 3) : [], meta: [{ searchResultsTotal: 900 }] },
      ]);
    });

    const updates = await projectUpdatesQueryOptions('proj-1').queryFn();

    expect(updates).toHaveLength(3);
    expect(requests).toHaveLength(2);
  });
});
