import { describe, it, expect, beforeAll } from 'vitest';
import { bulkDownloadEnabled } from 'app/config/config';
import { documentsConfig } from './documents';
import { nativeQueryFor } from './native-query.spec-helper';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  nameContains: 'habitat',
  type: 'doctype-1',
  milestone: 'milestone-1',
  projectPhase: 'phase-1',
  documentAuthorType: 'author-1',
  datePostedStart: '2020-01-01',
  datePostedEnd: '2020-12-31',
  legislation: '2018',
  isFeatured: 'true',
};

/** The name `/documents` takes each filter under (eagle-demi `documentsKind`). */
const NATIVE: Record<string, string> = {
  nameContains: 'displayNameContains',
  type: 'typeId',
  milestone: 'milestoneId',
  projectPhase: 'projectPhaseId',
  documentAuthorType: 'documentAuthorTypeId',
  datePostedStart: 'datePostedStart',
  datePostedEnd: 'datePostedEnd',
  legislation: 'legislation',
  isFeatured: 'isFeatured',
};

const ADVANCED_IDS = documentsConfig.advancedFields.map((field) => field.id);

/**
 * Filter ids the columns offer in the filter row, in column order. A year column is left out: its
 * value is a year standing for a range, so it reaches the API as two other ids.
 */
const COLUMN_FILTER_IDS = documentsConfig.columns
  .filter((column) => column.filter && column.filter !== 'year')
  .map((column) => column.filterId ?? column.key);

let requested: URLSearchParams;

beforeAll(async () => {
  requested = await nativeQueryFor(documentsConfig, { keywords: 'lng', ...FILLED });
});

describe('documents record type', () => {
  it('reads /documents, newest first', () => {
    expect(documentsConfig.kind).toBe('documents');
    expect(documentsConfig.defaultSort).toBe('-datePosted');
  });

  it('offers the document column filters', () => {
    expect(COLUMN_FILTER_IDS).toEqual([
      'nameContains',
      'type',
      'milestone',
      'projectPhase',
      'documentAuthorType',
    ]);
  });

  it('sorts by every column', () => {
    const unsorted = documentsConfig.columns.filter((column) => column.sortable === false);

    expect(unsorted.map((column) => column.key)).toEqual([]);
  });

  it('filters the date posted column by year', () => {
    const posted = documentsConfig.columns.find((column) => column.key === 'datePosted');

    expect(posted).toMatchObject({ filter: 'year', date: true });
  });

  it('offers the posted-date range, legislation and featured advanced fields', () => {
    expect(ADVANCED_IDS).toEqual(['datePostedStart', 'datePostedEnd', 'legislation', 'isFeatured']);
    expect(documentsConfig.advancedFields.at(-1)?.kind).toBe('toggle');
  });

  it('names the two ends of the posted range as the range they bound', () => {
    expect(
      documentsConfig.advancedFields
        .filter((field) => field.kind === 'date')
        .map((field) => field.label),
    ).toEqual(['Posted from', 'Posted to']);
  });

  it('columns lead with a locked link to the document', () => {
    expect(documentsConfig.columns.map((column) => column.label)).toEqual([
      'Name',
      'Date posted',
      'Document type',
      'Milestone',
      'Project phase',
      'Author',
    ]);
    expect(documentsConfig.columns[0]).toMatchObject({ link: true, locked: true });
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED)).toEqual([...COLUMN_FILTER_IDS, ...ADVANCED_IDS]);
  });

  it.each(Object.keys(FILLED))('sends %s under the name /documents takes', (id) => {
    expect(requested.get(NATIVE[id] ?? '')).toBe(FILLED[id]);
  });

  it('sends two picks of one filter as a repeated parameter, which DEMI reads as an OR', async () => {
    const query = await nativeQueryFor(documentsConfig, 'type=doctype-1,doctype-2');

    expect(query.getAll('typeId')).toEqual(['doctype-1', 'doctype-2']);
  });

  it('sends the name text an old address holds as displayNameContains', async () => {
    const query = await nativeQueryFor(documentsConfig, 'record=documents&nameContains=habitat');

    expect(query.get('displayNameContains')).toBe('habitat');
    expect(query.has('nameContains')).toBe(false);
  });

  it('sends a posted year as the range it covers', async () => {
    const query = await nativeQueryFor(documentsConfig, 'datePosted=2021');

    expect(query.get('datePostedStart')).toBe('2021-01-01');
    expect(query.get('datePostedEnd')).toBe('2021-12-31');
  });

  it('fills the column dropdowns from the List collection', () => {
    const options = documentsConfig.optionsFrom(
      [
        { id: 'doctype-1', name: 'Amendment Package', type: 'doctype', legislation: 2018 },
        { id: 'milestone-1', name: 'Amendment', type: 'label', legislation: 2002 },
        { id: 'phase-1', name: 'Post decision', type: 'projectPhase' },
        { id: 'author-1', name: 'Proponent', type: 'author' },
      ],
      [],
    );

    expect(options['type']).toEqual([
      { value: 'doctype-1', label: 'Amendment Package', legislation: '2018' },
    ]);
    expect(options['milestone']).toEqual([
      { value: 'milestone-1', label: 'Amendment', legislation: '2002' },
    ]);
    expect(options['projectPhase']).toEqual([{ value: 'phase-1', label: 'Post decision' }]);
    expect(options['documentAuthorType']).toEqual([{ value: 'author-1', label: 'Proponent' }]);
    expect(options['legislation']).toEqual([
      { value: '2018', label: '2018 Act' },
      { value: '2002', label: '2002 Act' },
    ]);
  });

  it('offers selection only while bulk download is on', () => {
    expect(documentsConfig.selectable).toBe(bulkDownloadEnabled());
  });
});

describe('documents record link', () => {
  const nameColumn = documentsConfig.columns.find((column) => column.link);
  const inProject = { id: 'doc-1', displayName: 'Order.pdf', projectEagleId: 'p 1' };
  const external = (row: Record<string, unknown>) =>
    typeof nameColumn?.hrefExternal === 'function'
      ? nameColumn.hrefExternal(row)
      : nameColumn?.hrefExternal;

  it("points a document on a project page at that project's documents tab", () => {
    expect(nameColumn?.href?.(inProject)).toBe('/p/p%201/documents');
    expect(external(inProject)).toBe(false);
  });

  it('points a document with no project page at the file, which leaves the app', () => {
    const row = { id: 'doc-1', displayName: 'Order.pdf' };
    expect(nameColumn?.href?.(row)).toBe('/demi-search/documents/doc-1/download?redirect=1');
    expect(external(row)).toBe(true);
  });

  it('leaves a document with no id and no project unlinked', () => {
    expect(nameColumn?.href?.({ displayName: 'Order.pdf' })).toBeUndefined();
  });

  it('carries the keyword and the filters the tab reads, and nothing else', () => {
    const href = nameColumn?.searchHref?.(inProject, {
      keywords: 'fish habitat',
      filters: {
        type: ['doctype-1', 'doctype-2'],
        milestone: 'milestone-1',
        projectPhase: 'phase-1',
        documentAuthorType: 'author-1',
        nameContains: 'order',
        legislation: '2018',
        isFeatured: 'true',
      },
      yearIds: ['datePosted'],
    });
    const url = new URL(href ?? '', 'http://localhost');
    expect(url.pathname).toBe('/p/p%201/documents');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      keywords: 'fish habitat',
      type: 'doctype-1,doctype-2',
      milestone: 'milestone-1',
      projectPhase: 'phase-1',
      documentAuthorType: 'author-1',
    });
  });

  it('carries a posted year as its range, behind the bounds the panel set', () => {
    const href = nameColumn?.searchHref?.(inProject, {
      keywords: '',
      filters: { datePosted: '2023', datePostedStart: '2023-06-01' },
      yearIds: ['datePosted'],
    });
    const url = new URL(href ?? '', 'http://localhost');
    expect(url.searchParams.get('datePostedStart')).toBe('2023-06-01');
    expect(url.searchParams.get('datePostedEnd')).toBe('2023-12-31');
    expect(url.searchParams.has('keywords')).toBe(false);
  });
});
