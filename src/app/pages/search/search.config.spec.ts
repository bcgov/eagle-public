import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from 'app/config/config';
import { buildSearchFilters, createSearchConfig, SEARCH_TABS, visibleSearchTabs } from './search.config';
import { FilterType } from 'app/components/filters/filter-object';

const LISTS = [
  { _id: 'm1', name: 'Amendment', type: 'label', legislation: 2002 },
  { _id: 'a1', name: 'Proponent', type: 'author', legislation: 2018 },
  { _id: 't1', name: 'Letter', type: 'doctype', legislation: 2002 },
  { _id: 'p1', name: 'Pre-Application', type: 'projectPhase', legislation: 2018 },
  { _id: 'x1', name: 'Skeena', type: 'region', legislation: 2002 }
];

describe('visibleSearchTabs', () => {
  it('keeps both tabs when content search is enabled', () => {
    expect(visibleSearchTabs(true)).toEqual(SEARCH_TABS);
  });

  it('drops the Document Content tab when content search is disabled', () => {
    expect(visibleSearchTabs(false)).toEqual([]);
  });
});

describe('createSearchConfig', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
  });

  async function configWith(contentSearch: boolean) {
    window.__env = { logLevel: 4, CONTENT_SEARCH: contentSearch };
    await loadConfig();
    return createSearchConfig([], LISTS);
  }

  it('hides the Document Content tab when the flag is off', async () => {
    expect((await configWith(false)).tabs).toEqual([]);
  });

  it('shows the Document Content tab when the flag is on', async () => {
    expect((await configWith(true)).tabs?.map(tab => tab.label)).toEqual(['Documents', 'Document Content']);
  });

  it('hands the lists to the rows so ids render as names', async () => {
    expect((await configWith(false)).rowData).toEqual({ lists: LISTS });
  });
});

describe('buildSearchFilters', () => {
  const filters = buildSearchFilters(LISTS);

  it('builds the date range first, then the four multi-selects', () => {
    expect(filters.map(filter => filter.id)).toEqual([
      'issuedDate',
      'milestone',
      'documentAuthorType',
      'type',
      'projectPhase'
    ]);
  });

  it('writes the date range to the two params the API filters on', () => {
    expect(filters[0]!.type).toBe(FilterType.DateRange);
    expect(filters[0]!.filterDefinition.startDateId).toBe('datePostedStart');
    expect(filters[0]!.filterDefinition.endDateId).toBe('datePostedEnd');
  });

  it('sorts each List item into the filter its type belongs to', () => {
    const options = (id: string) => filters.find(filter => filter.id === id)!.filterDefinition.options;
    expect(options('milestone')).toEqual([LISTS[0]]);
    expect(options('documentAuthorType')).toEqual([LISTS[1]]);
    expect(options('type')).toEqual([LISTS[2]]);
    expect(options('projectPhase')).toEqual([LISTS[3]]);
  });

  it('groups the options by legislation year and matches URL values by id', () => {
    const milestone = filters[1]!;
    expect(milestone.filterDefinition.group?.name).toBe('legislation');
    expect(milestone.filterDefinition.matchId).toBe(true);
  });
});
