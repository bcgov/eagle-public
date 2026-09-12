import { describe, it, expect, beforeAll } from 'vitest';
import { toApiFilters } from 'app/components/display-grid/use-grid-url-state';
import { fetchData, SearchParamObject } from 'app/api/search';
import { bulkDownloadEnabled } from 'app/config/config';
import { capturedRequestUrl } from '../../../../test-utils';
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

const ADVANCED_IDS = documentsConfig.advancedFields.map((field) => field.id);

/**
 * Filter ids the columns offer in the filter row, in column order. A year column is left out: its
 * value is a year standing for a range, so it reaches the API as two other ids.
 */
const COLUMN_FILTER_IDS = documentsConfig.columns
  .filter((column) => column.filter && column.filter !== 'year')
  .map((column) => column.filterId ?? column.key);

let requested: string;

async function urlFor(filters: Record<string, string>): Promise<string> {
  return capturedRequestUrl(() =>
    fetchData(
      new SearchParamObject(
        'documents',
        'lng',
        documentsConfig.dataset,
        [],
        1,
        25,
        documentsConfig.defaultSort,
        {},
        false,
        '',
        filters,
      ),
    ),
  );
}

beforeAll(async () => {
  requested = await urlFor(FILLED);
});

describe('documents record type', () => {
  it('searches the Document dataset, newest first', () => {
    expect(documentsConfig.dataset).toBe('Document');
    expect(documentsConfig.defaultSort).toBe('-datePosted');
  });

  it('offers the four document column filters', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['type', 'milestone', 'projectPhase', 'documentAuthorType']);
  });

  it('filters the date posted column by year', () => {
    const posted = documentsConfig.columns.find((column) => column.key === 'datePosted');

    expect(posted).toMatchObject({ filter: 'year', date: true });
  });

  it('offers the posted-date range, legislation and featured advanced fields', () => {
    expect(ADVANCED_IDS).toEqual(['datePostedStart', 'datePostedEnd', 'legislation', 'isFeatured']);
    expect(documentsConfig.advancedFields.at(-1)?.kind).toBe('toggle');
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

  it.each([...COLUMN_FILTER_IDS, ...ADVANCED_IDS])('names %s to the API as and[]', (id) => {
    expect(requested).toContain(`and[${id}]=${FILLED[id]}`);
  });

  it.each([...COLUMN_FILTER_IDS, ...ADVANCED_IDS])('wraps %s once for a URL', (id) => {
    expect(toApiFilters(FILLED)[`and[${id}]`]).toBe(FILLED[id]);
  });

  it('sends two picks of one filter as two and[] terms, which the API reads as an OR', async () => {
    const url = await urlFor({ type: 'doctype-1,doctype-2' });

    expect(url).toContain('and[type]=doctype-1');
    expect(url).toContain('and[type]=doctype-2');
  });

  it('fills the column dropdowns from the List collection', () => {
    const options = documentsConfig.optionsFrom(
      [
        { _id: 'doctype-1', name: 'Amendment Package', type: 'doctype', legislation: 2018 },
        { _id: 'milestone-1', name: 'Amendment', type: 'label', legislation: 2002 },
        { _id: 'phase-1', name: 'Post decision', type: 'projectPhase' },
        { _id: 'author-1', name: 'Proponent', type: 'author' },
      ],
      [],
    );

    expect(options['type']).toEqual([{ value: 'doctype-1', label: 'Amendment Package' }]);
    expect(options['milestone']).toEqual([{ value: 'milestone-1', label: 'Amendment' }]);
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
    expect(nameColumn?.href?.({ _id: 'doc-1', displayName: 'Order.pdf' })).toBe(
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
