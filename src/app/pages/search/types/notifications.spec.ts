import { describe, it, expect, beforeAll } from 'vitest';
import { fetchData, SearchParamObject } from 'app/api/search';
import { columnFiltersForPanel } from 'app/components/display-grid/grid-helpers';
import { Constants } from 'app/utils/constants';
import { capturedRequestUrl } from '../../../../test-utils';
import { notificationsConfig } from './notifications';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  type: 'Mines',
  region: 'Cariboo',
  pcp: 'open',
  decision: 'In Progress',
};

const COLUMN_FILTER_IDS = notificationsConfig.columns
  .filter((column) => column.filter && column.filter !== 'year')
  .map((column) => column.filterId ?? column.key);

const options = notificationsConfig.optionsFrom([], []);

let requested: string;

beforeAll(async () => {
  requested = await capturedRequestUrl(() =>
    fetchData(
      new SearchParamObject(
        'notifications',
        'wind',
        notificationsConfig.dataset,
        [],
        1,
        25,
        notificationsConfig.defaultSort,
        {},
        false,
        '',
        FILLED,
      ),
    ),
  );
});

describe('notifications record type', () => {
  it('searches the ProjectNotification dataset in the order the old page used', () => {
    expect(notificationsConfig.dataset).toBe('ProjectNotification');
    expect(notificationsConfig.defaultSort).toBe('-_id');
  });

  it('draws each notification as a card with no column headings over it', () => {
    expect(notificationsConfig.template).toBe('list');
    expect(notificationsConfig.headerless).toBe(true);
    expect(notificationsConfig.rowComponent).toBeTypeOf('function');
    expect(notificationsConfig.selectable).toBe(false);
  });

  it('offers the four filters the project notifications page offered', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['type', 'region', 'pcp', 'decision']);
    expect(notificationsConfig.advancedFields).toEqual([]);
  });

  it('puts every one of them in the panel, which is the only place a card layout has', () => {
    expect(columnFiltersForPanel(notificationsConfig.columns).map((field) => field.id)).toEqual([
      'type',
      'region',
      'pcp',
      'decision',
    ]);
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED)).toEqual(COLUMN_FILTER_IDS);
  });

  /* These values are the option labels themselves, spaces and all: unlike the id-backed filters,
     a notification stores the words. The space is encoded by `fetch`, not by the caller. */
  it.each(COLUMN_FILTER_IDS)('names %s to the API as and[]', (id) => {
    expect(requested).toContain(`and[${id}]=${FILLED[id]}`);
  });

  it('fills the dropdowns from the shared constants, not from a request', () => {
    expect(options['type']).toHaveLength(Constants.TEMPORARY_PROJECT_TYPE.length);
    expect(options['region']).toHaveLength(Constants.REGIONS_COLLECTION.length);
    expect(options['decision']).toHaveLength(Constants.PROJECT_NOTIFICATION_DECISIONS.length);
    expect(options['pcp']).toEqual([
      { value: 'none', label: 'None' },
      { value: 'pending', label: 'Upcoming' },
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
  });
});

describe('notifications record link', () => {
  const nameColumn = notificationsConfig.columns.find((column) => column.link);

  it('points a notification that became a project at that project', () => {
    expect(nameColumn?.href?.({ _id: 'n1', associatedProjectId: 'p9' })).toBe('/p/p9');
  });

  it('leaves a notification with no project unlinked', () => {
    expect(nameColumn?.href?.({ _id: 'n1' })).toBeUndefined();
  });
});
