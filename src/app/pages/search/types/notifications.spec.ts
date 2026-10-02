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

const ADVANCED_IDS = notificationsConfig.advancedFields.map((field) => field.id);

const OFFERED_IDS = [...COLUMN_FILTER_IDS, ...ADVANCED_IDS];

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
  it('searches the ProjectNotification dataset, newest received first', () => {
    expect(notificationsConfig.dataset).toBe('ProjectNotification');
    expect(notificationsConfig.defaultSort).toBe('-notificationReceivedDate');
  });

  it('asks the API for that order', () => {
    expect(requested).toContain('sortBy=-notificationReceivedDate');
  });

  it('draws the notifications as a table with column headings', () => {
    expect(notificationsConfig.template).toBe('grid');
    expect(notificationsConfig.selectable).toBe(false);
  });

  it('heads the table Name, Type, Region, Proponent, Decision, Received', () => {
    expect(notificationsConfig.columns.map((column) => column.label)).toEqual([
      'Name',
      'Type',
      'Region',
      'Proponent',
      'Decision',
      'Received',
    ]);
  });

  it('leads with a locked link on the name', () => {
    expect(notificationsConfig.columns[0]).toMatchObject({ key: 'name', link: true, locked: true });
  });

  it('lets the reader sort by the received date the table opens on', () => {
    const received = notificationsConfig.columns.find(
      (column) => column.key === 'notificationReceivedDate',
    );

    expect(received).toMatchObject({ sortable: true, date: true });
  });

  it('reads a proponent that arrives populated', () => {
    const proponent = notificationsConfig.columns.find((column) => column.key === 'proponent');

    expect(proponent?.render?.({ proponent: { name: 'Acme Aggregates Ltd.' } })).toBe(
      'Acme Aggregates Ltd.',
    );
  });

  it('filters type, region and decision from their columns', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['type', 'region', 'decision']);
  });

  it('keeps the comment period filter in the panel, as it has no column', () => {
    expect(ADVANCED_IDS).toEqual(['pcp']);
  });

  it('puts the column filters in the panel too, in column order', () => {
    expect(columnFiltersForPanel(notificationsConfig.columns).map((field) => field.id)).toEqual([
      'type',
      'region',
      'decision',
    ]);
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED).sort()).toEqual([...OFFERED_IDS].sort());
  });

  /* These values are the option labels themselves, spaces and all: unlike the id-backed filters,
     a notification stores the words. The space is encoded by `fetch`, not by the caller. */
  it.each(OFFERED_IDS)('names %s to the API as and[]', (id) => {
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

  it('points a notification with no project at its own page', () => {
    expect(nameColumn?.href?.({ _id: 'n1' })).toBe('/pn/n1');
  });

  it('treats an empty associated project id as no project', () => {
    expect(nameColumn?.href?.({ _id: 'n1', associatedProjectId: '' })).toBe('/pn/n1');
  });

  it('treats an associated project id that is not a string as no project', () => {
    expect(nameColumn?.href?.({ _id: 'n1', associatedProjectId: { _id: 'p9' } })).toBe('/pn/n1');
  });

  it('leaves a row with no id unlinked', () => {
    expect(nameColumn?.href?.({ name: 'Orphan' })).toBeUndefined();
  });
});
