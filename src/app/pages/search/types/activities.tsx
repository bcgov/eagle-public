/* eslint-disable react-refresh/only-export-components -- a record type is its config and the row
   that draws it, and splitting the two would only make them import each other. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ListRow, type ListRowAttachment } from 'app/components/display-grid/list-row';
import type { GridColumn, ValueOption } from 'app/components/display-grid/types';
import { isSafeUrl } from 'app/utils/safe-url';
import { RECORD_DATASETS, type RecordTypeConfig, type SearchMeta } from './record-type';

type Row = Record<string, unknown>;

/** Activities are dated with `dateAdded`, not the shared `datePosted` the other tabs sort by. */
export const ACTIVITIES_SORT = '-dateAdded';

/**
 * The index field behind "Documents attached". eagle-demi 0.6 adds `documentUrl` to the activities
 * datasource; an index without it answers a query that names it under `meta[0].dropped`.
 */
export const ATTACHMENTS_FILTER_ID = 'documentUrl';

/** Whether a response said the index carries no `documentUrl`, so the control can narrow nothing. */
export function attachmentsFilterDropped(meta?: SearchMeta[] | null): boolean {
  return !!meta?.[0]?.dropped?.includes(ATTACHMENTS_FILTER_ID);
}

/**
 * `RecentActivity.type` is free text in Mongo, written from the fixed list the admin app offers
 * (`Constants.activityTypes` in eagle-admin), so the filter offers those four and nothing else.
 */
const ACTIVITY_KINDS = [
  'News',
  'Project Notification News',
  'Project Notification Public Comment Period',
  'Public Comment Period',
];

const KIND_OPTIONS: ValueOption[] = ACTIVITY_KINDS.map((kind) => ({ value: kind, label: kind }));

/** The project an update belongs to: populated on some reads, a bare id on others. */
function projectOf(row: Row): { id: string; name: string } {
  const project = row['project'];
  if (project && typeof project === 'object') {
    const held = project as { _id?: unknown; name?: unknown };
    return { id: String(held._id ?? ''), name: String(held.name ?? '') };
  }
  return { id: String(project ?? ''), name: '' };
}

/**
 * What the update is about. An update raised against a project notification rather than a project
 * carries the notification's name instead, which is the line the news page shows today.
 */
function subjectName(row: Row): string {
  const notification = row['projectNotification'];
  const held = notification && typeof notification === 'object' ? notification : {};
  return (
    projectOf(row).name ||
    String(row['notificationName'] ?? '') ||
    String((held as { name?: unknown }).name ?? '')
  );
}

/** The project's own page. `/p/:id` lands on the overview tab. */
function projectHref(row: Row): string | undefined {
  const { id } = projectOf(row);
  return id === '' ? undefined : `/p/${id}`;
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * The update's body as words. `content` is stored as HTML, and the row clamps, excerpts and
 * highlights plain text, so the markup comes out here rather than being rendered and measured.
 */
export function plainText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The file an update points at, named by the last segment of its URL. The record carries no size
 * and no file type, so the row offers the name and nothing else.
 */
export function attachmentsOf(row: Row): ListRowAttachment[] {
  const url = row[ATTACHMENTS_FILTER_ID];
  // A `docs?folder` link is a folder listing rather than a file, which the news page skips too.
  if (!isSafeUrl(url) || url.includes('docs?folder')) return [];
  const last = (url.split('?')[0] ?? '').split('/').pop() ?? '';
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // A stray percent sign is not a reason to drop the link; show the segment as it is written.
  }
  return [{ name: name || 'Attached document', href: url }];
}

/**
 * The posted date as the meta line sets it: numeric `YYYY-MM-DD`, the same form the date columns
 * carry. The line is a dense run of facts beside a headline rather than prose, and a long date
 * there reads as the first half of the sentence the headline finishes. UTC, because the feed
 * sends midnight dates and a local zone slides them into the previous day.
 */
export function isoDay(value: unknown): string {
  const text = String(value ?? '');
  if (text === '') return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

/** One update as a full-width row: when and what it was, the headline, the body, and its file. */
export function ActivityRow({ row }: { row: Row }) {
  const { id } = projectOf(row);
  const subject = subjectName(row);
  const kind = String(row['type'] ?? '');

  const meta: ReactNode[] = [];
  const posted = isoDay(row['dateAdded']);
  if (posted) meta.push(posted);
  if (kind) meta.push(kind);
  if (subject) {
    meta.push(
      id === '' ? (
        subject
      ) : (
        <Link to={`/p/${id}`} key="project">
          {subject}
        </Link>
      ),
    );
  }

  return (
    <ListRow
      meta={meta}
      title={String(row['headline'] ?? '')}
      body={plainText(row['content'])}
      attachments={attachmentsOf(row)}
    />
  );
}

/**
 * Columns are the record's fields rather than a layout here: a list row draws itself. They carry
 * the Kind filter, which the panel picks up because a list has no filter row to put it in.
 */
const COLUMNS: GridColumn<Row>[] = [
  { key: 'headline', label: 'Update', sortable: true, locked: true, width: '52%' },
  {
    key: 'dateAdded',
    label: 'Posted',
    sortable: true,
    date: true,
    primaryDate: true,
    width: '14%',
  },
  { key: 'type', label: 'Kind', filter: 'values', filterId: 'type', width: '16%' },
  {
    key: 'project',
    label: 'Project',
    link: true,
    href: projectHref,
    render: subjectName,
    width: '18%',
  },
];

/** Activities and updates: the records the `/news` page listed, newest first. */
export const activitiesConfig: RecordTypeConfig = {
  id: 'activities',
  label: 'Activities & updates',
  dataset: RECORD_DATASETS.activities,
  defaultSort: ACTIVITIES_SORT,
  template: 'list',
  columns: COLUMNS,
  advancedFields: [
    { id: 'dateAddedStart', label: 'Posted from', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'dateAddedEnd', label: 'Posted to', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: ATTACHMENTS_FILTER_ID, label: 'Documents attached', kind: 'toggle' },
  ],
  optionsFrom: () => ({ type: KIND_OPTIONS }),
  selectable: false,
  headerless: false,
  rowComponent: ActivityRow,
};
