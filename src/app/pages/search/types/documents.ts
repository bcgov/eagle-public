import type { GridColumn, ValueOption } from 'app/components/display-grid/types';
import { bulkDownloadEnabled } from 'app/config/config';
import { DOCUMENT_FILTERS } from 'app/pages/project/document-filters';
import { documentDownloadUrl } from 'app/utils/utils';
import {
  RECORD_DATASETS,
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
} from './record-type';

export const DOCUMENTS_SORT = '-datePosted';

/** The file itself, the target the old document tables used. It leaves the app. */
function documentHref(row: Record<string, unknown>): string | undefined {
  const id = row['_id'];
  return typeof id === 'string' && id !== '' ? documentDownloadUrl({ _id: id }) : undefined;
}

const COLUMNS: GridColumn<Record<string, unknown>>[] = [
  {
    key: 'displayName',
    label: 'Name',
    sortable: true,
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
    // One whole year, which the page turns into the range the index takes.
    filter: 'year',
    date: true,
    primaryDate: true,
    width: '13%',
  },
  { key: 'type', label: 'Document type', filter: 'values', filterId: 'type', width: '16%' },
  { key: 'milestone', label: 'Milestone', filter: 'values', filterId: 'milestone', width: '17%' },
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
  dataset: RECORD_DATASETS.documents,
  defaultSort: DOCUMENTS_SORT,
  template: 'grid',
  columns: COLUMNS,
  advancedFields: [
    { id: 'datePostedStart', label: 'Posted after', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'datePostedEnd', label: 'Posted before', kind: 'date', placeholder: 'YYYY-MM-DD' },
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
  headerless: false,
};
