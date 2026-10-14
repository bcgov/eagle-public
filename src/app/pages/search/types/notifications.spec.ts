import { describe, it, expect, beforeAll } from 'vitest';
import { searchPage } from 'app/api/unified-search';
import { Constants } from 'app/utils/constants';
import { capturedRequestUrl } from '../../../../test-utils';
import { toNativeFilters } from '../search-filters';
import { notificationsConfig } from './notifications';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  type: 'Mines',
  region: 'Cariboo',
  decision: 'In Progress',
  pcp: 'open',
};

const COLUMN_FILTER_IDS = notificationsConfig.columns
  .filter((column) => column.filter)
  .map((column) => column.filterId ?? column.key);

const ADVANCED_IDS = notificationsConfig.advancedFields.map((field) => field.id);

const options = notificationsConfig.optionsFrom([], []);

let requested: URLSearchParams;

beforeAll(async () => {
  const url = await capturedRequestUrl(() =>
    searchPage(notificationsConfig.kind, {
      page: 1,
      pageSize: 25,
      q: 'wind',
      sort: 'notificationReceivedDate',
      filters: toNativeFilters(FILLED, [], notificationsConfig.wire),
    }),
  );
  requested = new URL(url, 'http://localhost').searchParams;
});

describe('notifications record type', () => {
  it('reads /notifications, newest received first', () => {
    expect(notificationsConfig.kind).toBe('notifications');
    expect(notificationsConfig.defaultSort).toBe('-notificationReceivedDate');
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

  it('sorts only by the two fields /notifications takes', () => {
    const sortable = notificationsConfig.columns.filter((column) => column.sortable !== false);

    expect(sortable.map((column) => column.key)).toEqual(['name', 'notificationReceivedDate']);
  });

  it('lets the reader sort by the received date the table opens on', () => {
    const received = notificationsConfig.columns.find(
      (column) => column.key === 'notificationReceivedDate',
    );

    expect(received).toMatchObject({ sortable: true, date: true });
  });

  it('shows the proponent DEMI stores as plain text', () => {
    const proponent = notificationsConfig.columns.find((column) => column.key === 'proponent');

    expect(proponent?.render).toBeUndefined();
  });

  /* `/notifications` takes one value per filter and answers 400 for a repeated one, so each is a
     single pick in the panel rather than a multi-select column filter. */
  it('offers every filter as a single pick in the panel, none in the columns', () => {
    expect(COLUMN_FILTER_IDS).toEqual([]);
    expect(ADVANCED_IDS).toEqual(['type', 'region', 'decision', 'pcp']);
    expect(notificationsConfig.advancedFields.every((field) => field.kind === 'select')).toBe(true);
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED)).toEqual(ADVANCED_IDS);
  });

  /* These values are the option labels themselves: unlike the id-backed filters, a notification
     stores the words. */
  it.each(Object.keys(FILLED))('sends %s under its own name', (id) => {
    expect(requested.get(id)).toBe(FILLED[id]);
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
    expect(nameColumn?.href?.({ id: 'n1', associatedProjectId: 'p9' })).toBe('/p/p9');
  });

  it('points a notification with no project at its own page', () => {
    expect(nameColumn?.href?.({ id: 'n1' })).toBe('/pn/n1');
  });

  it('treats an empty associated project id as no project', () => {
    expect(nameColumn?.href?.({ id: 'n1', associatedProjectId: '' })).toBe('/pn/n1');
  });

  it('treats an associated project id that is not a string as no project', () => {
    expect(nameColumn?.href?.({ id: 'n1', associatedProjectId: { _id: 'p9' } })).toBe('/pn/n1');
  });

  it('leaves a row with no id unlinked', () => {
    expect(nameColumn?.href?.({ name: 'Orphan' })).toBeUndefined();
  });
});
