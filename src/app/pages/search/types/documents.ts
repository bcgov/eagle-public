import type { ValueOption } from 'app/components/display-grid/types';
import { bulkDownloadEnabled } from 'app/config/config';
import { DOCUMENT_FILTERS } from 'app/pages/project/document-filters';
import { documentDownloadUrl } from 'app/utils/utils';
import { toNativeFilters } from '../search-filters';
import {
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
  type SearchColumn,
  type SearchContext,
} from './record-type';

export const DOCUMENTS_SORT = '-datePosted';

/** The file itself, the target the old document tables used. It leaves the app. */
function documentHref(row: Record<string, unknown>): string | undefined {
  const id = row['id'];
  return typeof id === 'string' && id !== '' ? documentDownloadUrl({ _id: id }) : undefined;
}

/** The filters the project documents tab reads under the same URL id and List ids. */
const CARRIED_FILTERS = Object.fromEntries(
  [...Object.keys(DOCUMENT_FILTERS), 'datePostedStart', 'datePostedEnd'].map((id) => [id, id]),
);

const NO_SEARCH: SearchContext = { keywords: '', filters: {}, yearIds: [] };

/** The Eagle id of the project page the document sits on. DEMI leaves it off for none, or no access. */
function projectOf(row: Record<string, unknown>): string | undefined {
  const project = row['projectEagleId'];
  return typeof project === 'string' && project !== '' ? project : undefined;
}

/** The project's documents tab, narrowed by the search; a document with no project page keeps its file. */
function projectDocumentsHref(
  row: Record<string, unknown>,
  search: SearchContext,
): string | undefined {
  const project = projectOf(row);
  if (!project) return documentHref(row);
  const query = new URLSearchParams();
  if (search.keywords) query.set('keywords', search.keywords);
  const carried = toNativeFilters(search.filters, search.yearIds, CARRIED_FILTERS);
  for (const [id, value] of Object.entries(carried)) {
    query.set(id, Array.isArray(value) ? value.join(',') : value);
  }
  const path = `/p/${encodeURIComponent(project)}/documents`;
  const carriedQuery = query.toString();
  return carriedQuery ? `${path}?${carriedQuery}` : path;
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
    href: (row) => projectDocumentsHref(row, NO_SEARCH),
    searchHref: projectDocumentsHref,
    hrefExternal: (row) => !projectOf(row),
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
