import { Constants } from 'app/utils/constants';
import { rowValueOptions } from '../search-filters';
import {
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
  type SearchColumn,
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

/** The project's own page, by its Eagle id. `/p/:id` lands on the overview tab. */
function projectHref(row: Record<string, unknown>): string | undefined {
  const id = row['eagleId'];
  return typeof id === 'string' && id !== '' ? `/p/${id}` : undefined;
}

/**
 * Widths add up to 100% with every column on. A hidden column is not drawn, and the fixed table
 * spreads the width it leaves across the columns still showing.
 */
const COLUMNS: SearchColumn[] = [
  {
    key: 'name',
    label: 'Project',
    sortable: true,
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
    // Said outright: the phone sort select offers newest and oldest only for a date marked sortable.
    sortable: true,
    // One whole year, which the page sends as the `dateUpdatedStart`/`End` range.
    filter: 'year',
    date: true,
    primaryDate: true,
    defaultHidden: true,
    width: '12%',
  },
  {
    key: 'proponentName',
    label: 'Proponent',
    filter: 'values',
    filterId: 'proponent',
    width: '18%',
  },
  {
    key: 'projectType',
    label: 'Type',
    filter: 'values',
    filterId: 'type',
    width: '14%',
  },
  {
    // The home page's projects-by-type band calls `sector` the sub-type.
    key: 'sector',
    label: 'Sub-type',
    filter: 'values',
    filterId: 'sector',
    defaultHidden: true,
    width: '13%',
  },
  {
    key: 'region',
    label: 'Region',
    filter: 'values',
    filterId: 'region',
    width: '10%',
  },
  {
    key: 'currentPhaseName',
    // The phase is an object on the row: DEMI sorts by its name, and answers 400 for the bare key.
    sortKey: 'currentPhaseName.name',
    label: 'Phase',
    filter: 'values',
    filterId: 'currentPhaseName',
    width: '11%',
  },
];

/** Projects, from `/projects`. Only the filters below narrow. */
export const projectsConfig: RecordTypeConfig = {
  id: 'projects',
  label: 'Projects',
  kind: 'projects',
  wire: {
    nameContains: 'nameContains',
    type: 'projectType',
    proponent: 'proponentName',
    region: 'region',
    currentPhaseName: 'currentPhaseName',
    eacDecision: 'eacDecision',
    CEAAInvolvement: 'CEAAInvolvement',
    sector: 'sector',
    dateUpdatedStart: 'dateUpdatedStart',
    dateUpdatedEnd: 'dateUpdatedEnd',
    decisionDateStart: 'decisionDateStart',
    decisionDateEnd: 'decisionDateEnd',
  },
  // `/projects` filters by the proponent's name; the URL holds the org id it stands for.
  wireLabels: (orgs: OptionSource[]) => ({ proponent: toOptions(orgs) }),
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
      // Keyed by id: a name can carry the comma the URL splits picks on. Two orgs of one name are one pick.
      proponent: toOptions(orgs).filter(
        (option, at, all) => all.findIndex((other) => other.label === option.label) === at,
      ),
      type: toOptions(Constants.TEMPORARY_PROJECT_TYPE as OptionSource[]),
      region: toOptions(Constants.REGIONS_COLLECTION as OptionSource[]),
      currentPhaseName: ofType(LIST_TYPES.currentPhaseName),
      eacDecision: ofType(LIST_TYPES.eacDecision),
      CEAAInvolvement: ofType(LIST_TYPES.CEAAInvolvement),
    };
  },
  // No lookup lists the sub-types, and `sector` matches the stored text exactly: offer the rows'.
  optionsFromRows: (rows) => ({ sector: rowValueOptions(rows, 'sector') }),
  selectable: false,
};
