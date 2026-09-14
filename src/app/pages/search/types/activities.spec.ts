import { createElement } from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { fetchData, SearchParamObject } from 'app/api/search';
import { capturedRequestUrl } from '../../../../test-utils';
import {
  activitiesConfig,
  ActivityRow,
  attachmentsFilterDropped,
  attachmentsOf,
  plainText,
  ATTACHMENTS_FILTER_ID,
} from './activities';

/** One value per filter the tab offers, as a reader who filled in every control would leave it. */
const FILLED: Record<string, string> = {
  type: 'News',
  dateAddedStart: '2025-01-01',
  dateAddedEnd: '2025-12-31',
  documentUrl: 'true',
};

const ADVANCED_IDS = activitiesConfig.advancedFields.map((field) => field.id);

/** Filter ids the columns carry. A list has no filter row, so the panel shows these too. */
const COLUMN_FILTER_IDS = activitiesConfig.columns
  .filter((column) => column.filter && column.filter !== 'year')
  .map((column) => column.filterId ?? column.key);

const projectColumn = activitiesConfig.columns.find((column) => column.key === 'project');

let requested: string;

beforeAll(async () => {
  requested = await capturedRequestUrl(() =>
    fetchData(
      new SearchParamObject(
        'activities',
        'cedar',
        activitiesConfig.dataset,
        [],
        1,
        25,
        activitiesConfig.defaultSort,
        {},
        false,
        '',
        FILLED,
      ),
    ),
  );
});

describe('activities record type', () => {
  it('searches the RecentActivity dataset, newest first', () => {
    expect(activitiesConfig.dataset).toBe('RecentActivity');
    expect(activitiesConfig.defaultSort).toBe('-dateAdded');
  });

  it('draws each update as a list row rather than a table row', () => {
    expect(activitiesConfig.template).toBe('list');
    expect(activitiesConfig.rowComponent).toBeTypeOf('function');
    expect(activitiesConfig.selectable).toBe(false);
  });

  it('names its columns as the reader reads them', () => {
    expect(activitiesConfig.columns.map((column) => column.label)).toEqual([
      'Update',
      'Posted',
      'Kind',
      'Project',
    ]);
  });

  it('filters by kind in the columns and by date range and attachments in the panel', () => {
    expect(COLUMN_FILTER_IDS).toEqual(['type']);
    expect(ADVANCED_IDS).toEqual(['dateAddedStart', 'dateAddedEnd', ATTACHMENTS_FILTER_ID]);
    expect(activitiesConfig.advancedFields.at(-1)).toMatchObject({
      label: 'Documents attached',
      kind: 'toggle',
    });
  });

  it('covers every offered filter with a filled value', () => {
    expect(Object.keys(FILLED)).toEqual([...COLUMN_FILTER_IDS, ...ADVANCED_IDS]);
  });

  it.each([...COLUMN_FILTER_IDS, ...ADVANCED_IDS])('names %s to the API as and[]', (id) => {
    expect(requested).toContain(`and[${id}]=${FILLED[id]}`);
  });

  it('offers the four kinds the admin app writes', () => {
    expect(activitiesConfig.optionsFrom([], [])['type']).toEqual([
      { value: 'News', label: 'News' },
      { value: 'Project Notification News', label: 'Project Notification News' },
      {
        value: 'Project Notification Public Comment Period',
        label: 'Project Notification Public Comment Period',
      },
      { value: 'Public Comment Period', label: 'Public Comment Period' },
    ]);
  });
});

describe('activities project column', () => {
  it('points at the project the update belongs to', () => {
    expect(projectColumn?.href?.({ project: { _id: 'p1', name: 'Cedar LNG' } })).toBe('/p/p1');
    expect(projectColumn?.render?.({ project: { _id: 'p1', name: 'Cedar LNG' } })).toBe(
      'Cedar LNG',
    );
  });

  it('leaves an update with no project unlinked', () => {
    expect(projectColumn?.href?.({ headline: 'Site visit' })).toBeUndefined();
  });

  it('names the notification an update was raised against when it has no project', () => {
    expect(projectColumn?.render?.({ notificationName: 'Bear Creek Aggregate' })).toBe(
      'Bear Creek Aggregate',
    );
    expect(projectColumn?.render?.({ projectNotification: { name: 'Nechako Valley Wind' } })).toBe(
      'Nechako Valley Wind',
    );
  });
});

describe('attachments filter', () => {
  it('is dropped once the index says it carries no documentUrl', () => {
    expect(attachmentsFilterDropped([{ dropped: ['documentUrl'] }])).toBe(true);
  });

  it('stands while the index honours it', () => {
    expect(attachmentsFilterDropped([{ dropped: ['dateUpdated'] }])).toBe(false);
    expect(attachmentsFilterDropped([{ dropped: [] }])).toBe(false);
    expect(attachmentsFilterDropped(undefined)).toBe(false);
    expect(attachmentsFilterDropped(null)).toBe(false);
  });
});

describe('update body', () => {
  it('reads the stored HTML as words', () => {
    expect(plainText('<p>Comment period <b>opens</b>&nbsp;13 March.</p>')).toBe(
      'Comment period opens 13 March.',
    );
  });

  it('decodes the entities an editor leaves behind', () => {
    expect(plainText('Fish &amp; wildlife &quot;values&quot;')).toBe('Fish & wildlife "values"');
  });

  it('reads a missing body as nothing', () => {
    expect(plainText(undefined)).toBe('');
  });
});

describe('update attachment', () => {
  it('names the file after the last segment of its URL', () => {
    expect(
      attachmentsOf({
        documentUrl: '/api/document/d1/fetch/Inspection%20Record%202026-01-22.pdf',
      }),
    ).toEqual([
      {
        name: 'Inspection Record 2026-01-22.pdf',
        href: '/api/document/d1/fetch/Inspection%20Record%202026-01-22.pdf',
      },
    ]);
  });

  it('offers nothing for an update with no document', () => {
    expect(attachmentsOf({ headline: 'Site visit' })).toEqual([]);
  });

  it('skips a folder listing, which is not a file to download', () => {
    expect(attachmentsOf({ documentUrl: '/api/docs?folder=123' })).toEqual([]);
  });

  it('refuses a URL the browser should not follow', () => {
    // Built from parts so no linter rewrites the literal the test is about.
    const unsafe = `${'java'}script:alert(1)`;
    expect(attachmentsOf({ documentUrl: unsafe })).toEqual([]);
  });
});

describe('update meta line', () => {
  /** The row as the feed sends one: a midnight date, a kind, and the project it belongs to. */
  function renderRow() {
    return render(
      createElement(
        MemoryRouter,
        null,
        createElement(ActivityRow, {
          row: {
            headline: 'Amendment application accepted',
            dateAdded: '2026-02-18T00:00:00.000Z',
            type: 'News',
            project: { _id: 'p1', name: 'Cedar LNG' },
          },
        }),
      ),
    );
  }

  it('dates the update as YYYY-MM-DD, ahead of the kind and the project', () => {
    const { container } = renderRow();

    expect(container.querySelector('.display-grid__row-meta')?.textContent).toBe(
      '2026-02-18 · News · Cedar LNG',
    );
  });
});
