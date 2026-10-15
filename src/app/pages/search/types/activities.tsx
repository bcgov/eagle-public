/* eslint-disable react-refresh/only-export-components -- a record type is its config and the row
   that draws it, and splitting the two would only make them import each other. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ListRow, type ListRowAttachment } from 'app/components/display-grid/list-row';
import type { ValueOption } from 'app/components/display-grid/types';
import { FALLBACK_DOCUMENT_NAME } from 'app/components/update-detail/update-detail';
import { rewriteLegacyDocumentUrl } from 'app/utils/legacy-document-url';
import { htmlToText } from 'app/utils/safe-html';
import { fileName, isSafeUrl } from 'app/utils/safe-url';
import type { RecordTypeConfig, SearchColumn } from './record-type';

type Row = Record<string, unknown>;

/** Activities are dated with `dateAdded`, not the shared `datePosted` the other tabs sort by. */
export const ACTIVITIES_SORT = '-dateAdded';

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

/**
 * The project an update belongs to. `projectId` is its Eagle id; the name comes with it only when
 * the project is readable.
 */
function projectOf(row: Row): { id: string; name: string } {
  return {
    id: String(row['projectEagleId'] ?? row['projectId'] ?? ''),
    name: String(row['projectName'] ?? ''),
  };
}

/** What the update is about: its project, else the project notification it was raised against. */
function subjectName(row: Row): string {
  return projectOf(row).name || String(row['notificationName'] ?? '');
}

/** The project's own page. `/p/:id` lands on the overview tab. */
function projectHref(row: Row): string | undefined {
  const { id } = projectOf(row);
  return id === '' ? undefined : `/p/${id}`;
}

/**
 * The file an update points at, named by the file name its stored URL ends in. The record carries
 * no size and no file type, so the row offers the name and nothing else.
 */
export function attachmentsOf(row: Row): ListRowAttachment[] {
  const url = row['documentUrl'];
  // A `docs?folder` link is a folder listing rather than a file, which the news page skips too.
  if (typeof url !== 'string' || url.includes('docs?folder')) return [];
  const href = rewriteLegacyDocumentUrl(url);
  if (!isSafeUrl(href)) return [];
  return [{ name: fileName(url) ?? FALLBACK_DOCUMENT_NAME, href }];
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
      body={htmlToText(row['content'])}
      attachments={attachmentsOf(row)}
    />
  );
}

/**
 * Columns are the record's fields rather than a layout here: a list row draws itself. They carry
 * the Kind filter, which the panel picks up because a list has no filter row to put it in.
 */
const COLUMNS: SearchColumn<Row>[] = [
  { key: 'headline', label: 'Update', locked: true, width: '52%' },
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
    // A name joined from the project, which the update row does not store.
    sortable: false,
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
  noun: 'updates',
  kind: 'updates',
  wire: {
    type: 'type',
    dateAddedStart: 'dateAddedStart',
    dateAddedEnd: 'dateAddedEnd',
    // The toggle writes `true` or nothing, so only "has a file" is ever asked for.
    documentUrl: 'hasDocumentUrl',
  },
  defaultSort: ACTIVITIES_SORT,
  template: 'list',
  columns: COLUMNS,
  advancedFields: [
    { id: 'dateAddedStart', label: 'Posted from', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'dateAddedEnd', label: 'Posted to', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'documentUrl', label: 'Documents attached', kind: 'toggle' },
  ],
  optionsFrom: () => ({ type: KIND_OPTIONS }),
  selectable: false,
  rowComponent: ActivityRow,
};
