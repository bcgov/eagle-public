import type { ValueOption } from 'app/components/display-grid/types';
import { bulkDownloadEnabled } from 'app/config/config';
import { DOCUMENT_FILTERS } from 'app/pages/project/document-filters';
import { documentDownloadUrl } from 'app/utils/utils';
import {
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
  type SearchColumn,
} from './record-type';

export const DOCUMENTS_SORT = '-datePosted';

/** The file itself, the target the old document tables used. It leaves the app. */
function documentHref(row: Record<string, unknown>): string | undefined {
  const id = row['id'];
  return typeof id === 'string' && id !== '' ? documentDownloadUrl({ _id: id }) : undefined;
}

const COLUMNS: SearchColumn[] = [
  {
    key: 'displayName',
    label: 'Name',
    sortable: true,
    // The URL keeps the id the Angular search wrote; `/documents` takes it as `displayNameContains`.
    filter: 'text',
    filterId: 'nameContains',
    link: true,
    href: documentHref,
    hrefExternal: true,
    locked: true,
    width: '28%',
  },
  {
    key: 'datePosted',
    label: 'Date posted',
    sortable: true,
    // One whole year, which the page sends as the `datePostedStart`/`End` range.
    filter: 'year',
    date: true,
    primaryDate: true,
    width: '13%',
  },
  {
    key: 'type',
    label: 'Document type',
    filter: 'values',
    filterId: 'type',
    width: '16%',
  },
  {
    key: 'milestone',
    label: 'Milestone',
    filter: 'values',
    filterId: 'milestone',
    width: '17%',
  },
  {
    key: 'projectPhase',
    label: 'Project phase',
    filter: 'values',
    filterId: 'projectPhase',
    width: '17%',
  },
  {
    key: 'documentAuthorType',
    label: 'Author',
    filter: 'values',
    filterId: 'documentAuthorType',
    width: '9%',
  },
];

/** The Acts the `List` collection spans, newest first, as the legislation filter offers them. */
function legislationOptions(lists: OptionSource[]): ValueOption[] {
  const years = new Set<string>();
  for (const item of lists) {
    if (item.legislation) years.add(String(item.legislation));
  }
  return [...years]
    .sort()
    .reverse()
    .map((year) => ({ value: year, label: `${year} Act` }));
}

/** All documents, the tab the old `/search` page owned. */
export const documentsConfig: RecordTypeConfig = {
  id: 'documents',
  label: 'Documents',
  kind: 'documents',
  // The coded columns hold the `List` id under the field's `Id` companion; the row shows the name.
  wire: {
    nameContains: 'displayNameContains',
    type: 'typeId',
    milestone: 'milestoneId',
    projectPhase: 'projectPhaseId',
    documentAuthorType: 'documentAuthorTypeId',
    datePostedStart: 'datePostedStart',
    datePostedEnd: 'datePostedEnd',
    legislation: 'legislation',
    isFeatured: 'isFeatured',
  },
  defaultSort: DOCUMENTS_SORT,
  template: 'grid',
  columns: COLUMNS,
  advancedFields: [
    { id: 'datePostedStart', label: 'Posted from', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'datePostedEnd', label: 'Posted to', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'legislation', label: 'Legislation', kind: 'select' },
    { id: 'isFeatured', label: 'Featured documents', kind: 'toggle' },
  ],
  optionsFrom: (lists: OptionSource[]) => {
    const options: Record<string, ValueOption[]> = { legislation: legislationOptions(lists) };
    for (const [id, { listType }] of Object.entries(DOCUMENT_FILTERS)) {
      options[id] = toOptions(lists.filter((item) => item.type === listType));
    }
    return options;
  },
  selectable: bulkDownloadEnabled(),
};
