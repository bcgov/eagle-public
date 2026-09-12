import type { GridColumn, ValueOption } from 'app/components/display-grid/types';
import { bulkDownloadEnabled } from 'app/config/config';
import { DOCUMENT_FILTERS } from 'app/pages/project/document-filters';
import {
  RECORD_DATASETS,
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
} from './record-type';

export const DOCUMENTS_SORT = '-datePosted';

const COLUMNS: GridColumn<Record<string, unknown>>[] = [
  { key: 'displayName', label: 'Name', sortable: true, link: true, locked: true, width: '30%' },
  {
    key: 'datePosted',
    label: 'Date posted',
    sortable: true,
    date: true,
    primaryDate: true,
    width: '13%',
  },
  { key: 'type', label: 'Document type', filter: 'values', filterId: 'type', width: '16%' },
  { key: 'milestone', label: 'Milestone', filter: 'values', filterId: 'milestone', width: '15%' },
  {
    key: 'projectPhase',
    label: 'Project phase',
    filter: 'values',
    filterId: 'projectPhase',
    width: '13%',
  },
  {
    key: 'documentAuthorType',
    label: 'Author',
    filter: 'values',
    filterId: 'documentAuthorType',
    width: '13%',
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
  filterIds: ['type', 'milestone', 'projectPhase', 'documentAuthorType'],
  advancedFields: [
    { id: 'datePostedStart', label: 'Posted after', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'datePostedEnd', label: 'Posted before', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'legislation', label: 'Legislation', kind: 'select' },
    { id: 'isFeatured', label: 'Featured only', kind: 'toggle' },
  ],
  optionsFrom: (lists: OptionSource[]) => {
    const options: Record<string, ValueOption[]> = { legislation: legislationOptions(lists) };
    for (const [id, { listType }] of Object.entries(DOCUMENT_FILTERS)) {
      options[id] = toOptions(lists.filter((item) => item.type === listType));
    }
    return options;
  },
  recordHasPage: true,
  selectable: bulkDownloadEnabled(),
  headerless: false,
};
