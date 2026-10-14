import { describe, it, expect, beforeAll } from 'vitest';
import { searchPage } from 'app/api/unified-search';
import { bulkDownloadEnabled } from 'app/config/config';
import { capturedRequestUrl } from '../../../../test-utils';
import { toNativeFilters } from '../search-filters';
import { documentsConfig } from './documents';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
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

async function queryFor(filters: Record<string, string | string[]>): Promise<URLSearchParams> {
  const url = await capturedRequestUrl(() =>
    searchPage(documentsConfig.kind, {
      page: 1,
      pageSize: 25,
      q: 'lng',
      filters: toNativeFilters(filters, ['datePosted'], documentsConfig.wire),
    }),
  );
  return new URL(url, 'http://localhost').searchParams;
}

let requested: URLSearchParams;

beforeAll(async () => {
  requested = await queryFor(FILLED);
});

describe('documents record type', () => {
  it('reads /documents, newest first', () => {
    expect(documentsConfig.kind).toBe('documents');
    expect(documentsConfig.defaultSort).toBe('-datePosted');
  });

  it('offers the document column filters', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['type', 'milestone', 'projectPhase', 'documentAuthorType']);
  });

  it('sorts by the two fields /documents takes', () => {
    const sortable = documentsConfig.columns.filter((column) => column.sortable !== false);

    expect(sortable.map((column) => column.key)).toEqual(['displayName', 'datePosted']);
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
    const query = await queryFor({ type: ['doctype-1', 'doctype-2'] });

    expect(query.getAll('typeId')).toEqual(['doctype-1', 'doctype-2']);
  });

  it('sends a posted year as the range it covers', async () => {
    const query = await queryFor({ datePosted: '2021' });

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

  it('points the document name at the file, the target the old table used', () => {
    expect(nameColumn?.href?.({ id: 'doc-1', displayName: 'Order.pdf' })).toBe(
      '/demi-search/documents/doc-1/download?redirect=1',
    );
  });

  it('marks the target as leaving the app, so it opens as a plain anchor', () => {
    expect(nameColumn?.hrefExternal).toBe(true);
  });

  it('leaves a document with no id unlinked', () => {
    expect(nameColumn?.href?.({ displayName: 'Order.pdf' })).toBeUndefined();
  });
});
