import { describe, it, expect, beforeAll } from 'vitest';
import { Constants } from 'app/utils/constants';
import { nativeQueryFor } from './native-query.spec-helper';
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
  requested = await nativeQueryFor(
    notificationsConfig,
    { record: 'notifications', keywords: 'wind', ...FILLED },
    { sort: 'notificationReceivedDate' },
  );
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

  it('sorts by every column', () => {
    const unsorted = notificationsConfig.columns.filter((column) => column.sortable === false);

    expect(unsorted.map((column) => column.key)).toEqual([]);
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

  it('filters type, region and decision in their columns, and the comment period in the panel', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['type', 'region', 'decision']);
    expect(ADVANCED_IDS).toEqual(['pcp']);
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED)).toEqual([...COLUMN_FILTER_IDS, ...ADVANCED_IDS]);
  });

  it('sends several picks of a column filter as a repeated parameter, which DEMI reads as any', async () => {
    const query = await nativeQueryFor(
      notificationsConfig,
      'record=notifications&type=Mines,Energy-Electricity&region=Skeena,Cariboo' +
        '&decision=In%20Progress,Referred',
    );

    expect(query.getAll('type')).toEqual(['Mines', 'Energy-Electricity']);
    expect(query.getAll('region')).toEqual(['Skeena', 'Cariboo']);
    expect(query.getAll('decision')).toEqual(['In Progress', 'Referred']);
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

  it('encodes both ids, so a ? or # in them stays part of the path', () => {
    expect(nameColumn?.href?.({ id: 'n1', associatedProjectId: 'a?b#c' })).toBe('/p/a%3Fb%23c');
    expect(nameColumn?.href?.({ id: 'n?1#2' })).toBe('/pn/n%3F1%232');
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
