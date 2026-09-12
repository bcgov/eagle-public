import type { GridColumn } from 'app/components/display-grid/types';
import { Constants } from 'app/utils/constants';
import {
  RECORD_DATASETS,
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
  type SearchMeta,
} from './record-type';

/** Sort the tab asks for. The index gained `dateUpdated` in Phase 0 of the search work. */
export const PROJECTS_SORT = '-dateUpdated';

/** Sort used instead when the backend says it dropped `dateUpdated`, so rows stay in an order. */
export const PROJECTS_FALLBACK_SORT = '+name';

/** The `List` item `type` each list-backed project filter draws its options from. */
const LIST_TYPES = {
  currentPhaseName: 'projectPhase',
  eacDecision: 'eaDecisions',
  CEAAInvolvement: 'ceaaInvolvements',
};

/**
 * The sort to send. demi-search reports a field it could not honour under `meta[0].dropped`, so a
 * response naming `dateUpdated` means the index has no such field and the date sort would be
 * silently ignored: fall back to name order rather than show an arbitrary one.
 */
export function resolveSort(meta?: SearchMeta[] | null): string {
  return meta?.[0]?.dropped?.includes('dateUpdated') ? PROJECTS_FALLBACK_SORT : PROJECTS_SORT;
}

/** Proponent arrives populated on some reads and as a bare name on others. */
function proponentName(row: Record<string, unknown>): string {
  const proponent = row['proponent'];
  if (proponent && typeof proponent === 'object') {
    return String((proponent as { name?: unknown }).name ?? '');
  }
  return String(proponent ?? '');
}

/** The project's own page. `/p/:id` lands on the overview tab. */
function projectHref(row: Record<string, unknown>): string | undefined {
  const id = row['_id'];
  return typeof id === 'string' && id !== '' ? `/p/${id}` : undefined;
}

const COLUMNS: GridColumn<Record<string, unknown>>[] = [
  {
    key: 'name',
    label: 'Project',
    sortable: true,
    link: true,
    href: projectHref,
    locked: true,
    width: '24%',
  },
  {
    key: 'dateUpdated',
    label: 'Last updated',
    sortable: true,
    // One whole year, which the page turns into the range the index takes.
    filter: 'year',
    date: true,
    primaryDate: true,
    width: '14%',
  },
  {
    key: 'proponent',
    label: 'Proponent',
    filter: 'values',
    filterId: 'proponent',
    render: proponentName,
    width: '22%',
  },
  { key: 'type', label: 'Type', filter: 'values', filterId: 'type', width: '17%' },
  { key: 'region', label: 'Region', filter: 'values', filterId: 'region', width: '11%' },
  {
    key: 'currentPhaseName',
    label: 'Phase',
    filter: 'values',
    filterId: 'currentPhaseName',
    width: '12%',
  },
];

/**
 * Projects. Legislation is not offered here: the projects index carries no legislation field, so
 * the filter would land in `meta[0].dropped` and narrow nothing.
 */
export const projectsConfig: RecordTypeConfig = {
  id: 'projects',
  label: 'Projects',
  dataset: RECORD_DATASETS.projects,
  defaultSort: PROJECTS_SORT,
  template: 'grid',
  columns: COLUMNS,
  advancedFields: [
    { id: 'dateUpdatedStart', label: 'Updated after', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'dateUpdatedEnd', label: 'Updated before', kind: 'date', placeholder: 'YYYY-MM-DD' },
    // The Angular project list put these on the query string, so the redirect still carries them.
    { id: 'decisionDateStart', label: 'Decision after', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'decisionDateEnd', label: 'Decision before', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'eacDecision', label: 'EA decision', kind: 'select' },
    { id: 'CEAAInvolvement', label: 'IAAC involvement', kind: 'select' },
  ],
  optionsFrom: (lists: OptionSource[], orgs: OptionSource[]) => {
    const ofType = (type: string) => toOptions(lists.filter((item) => item.type === type));
    return {
      proponent: toOptions(orgs),
      type: toOptions(Constants.TEMPORARY_PROJECT_TYPE as OptionSource[]),
      region: toOptions(Constants.REGIONS_COLLECTION as OptionSource[]),
      currentPhaseName: ofType(LIST_TYPES.currentPhaseName),
      eacDecision: ofType(LIST_TYPES.eacDecision),
      CEAAInvolvement: ofType(LIST_TYPES.CEAAInvolvement),
    };
  },
  selectable: false,
  headerless: false,
};
