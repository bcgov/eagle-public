import type { GridColumn } from 'app/components/display-grid/types';
import { Constants } from 'app/utils/constants';
import { rowValueOptions } from '../search-filters';
import {
  RECORD_DATASETS,
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
} from './record-type';

/** What the tab lists by until the URL names a sort: project name, A to Z. */
export const PROJECTS_SORT = '+name';

/** The `List` item `type` each list-backed project filter draws its options from. */
const LIST_TYPES = {
  currentPhaseName: 'projectPhase',
  eacDecision: 'eaDecisions',
  CEAAInvolvement: 'ceaaInvolvements',
};

/** Proponent arrives populated on some reads and as a bare name on others. */
export function proponentName(row: Record<string, unknown>): string {
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

/**
 * Widths add up to 100% with every column on. A hidden column is not drawn, and the fixed table
 * spreads the width it leaves across the columns still showing.
 */
const COLUMNS: GridColumn<Record<string, unknown>>[] = [
  {
    key: 'name',
    label: 'Project',
    sortable: true,
    // demi-search reads `nameContains` as a match on the project's own `name`.
    filter: 'text',
    filterId: 'nameContains',
    link: true,
    href: projectHref,
    locked: true,
    width: '22%',
  },
  {
    key: 'dateUpdated',
    label: 'Last updated',
    sortable: true,
    // One whole year, which the page turns into the range the index takes.
    filter: 'year',
    date: true,
    primaryDate: true,
    defaultHidden: true,
    width: '12%',
  },
  {
    key: 'proponent',
    label: 'Proponent',
    filter: 'values',
    filterId: 'proponent',
    render: proponentName,
    width: '18%',
  },
  { key: 'type', label: 'Type', filter: 'values', filterId: 'type', width: '14%' },
  {
    /* The project's `sector`, which the home page's projects-by-type band calls its sub-type. Its
       menu lists only the sub-types on the page of results showing: the index has no facet for it. */
    key: 'sector',
    label: 'Sub-type',
    filter: 'values',
    filterId: 'sector',
    defaultHidden: true,
    width: '13%',
  },
  { key: 'region', label: 'Region', filter: 'values', filterId: 'region', width: '10%' },
  {
    key: 'currentPhaseName',
    label: 'Phase',
    filter: 'values',
    filterId: 'currentPhaseName',
    width: '11%',
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
    { id: 'dateUpdatedStart', label: 'Updated from', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'dateUpdatedEnd', label: 'Updated to', kind: 'date', placeholder: 'YYYY-MM-DD' },
    // The Angular project list put these on the query string, so the redirect still carries them.
    { id: 'decisionDateStart', label: 'Decision from', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'decisionDateEnd', label: 'Decision to', kind: 'date', placeholder: 'YYYY-MM-DD' },
    { id: 'eacDecision', label: 'EA decision', kind: 'select' },
    { id: 'CEAAInvolvement', label: 'Joint review with IAAC', kind: 'select' },
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
  // No `List` type or constant names the sub-types, so the menu offers the ones the page shows.
  optionsFromRows: (rows) => ({ sector: rowValueOptions(rows, 'sector') }),
  selectable: false,
  headerless: false,
};
