import { Constants } from 'app/utils/constants';
import { rowValueOptions } from '../search-filters';
import { isNotification, notificationMark } from './notification-mark';
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

/** The two kinds of row the tab lists, as `recordKind` names them. */
const RECORD_KINDS = [
  { code: 'project', name: 'Project' },
  { code: 'notification', name: 'Project notification' },
];

/**
 * A project's own page by its Eagle id; `/p/:id` lands on the overview tab. A notification opens
 * its own page, even once it has a project.
 */
function recordHref(row: Record<string, unknown>): string | undefined {
  const id = row[isNotification(row) ? 'id' : 'eagleId'];
  if (typeof id !== 'string' || id === '') return undefined;
  return `${isNotification(row) ? '/pn' : '/p'}/${encodeURIComponent(id)}`;
}

const PROJECTS_ONLY = 'Shows projects only';

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
    href: recordHref,
    badge: notificationMark,
    badgeAfter: true,
    locked: true,
    width: '20%',
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
    width: '10%',
  },
  {
    key: 'proponentName',
    label: 'Proponent',
    filter: 'values',
    filterId: 'proponent',
    width: '15%',
  },
  {
    key: 'projectType',
    label: 'Type',
    filter: 'values',
    filterId: 'type',
    width: '12%',
  },
  {
    // The home page's projects-by-type band calls `sector` the sub-type.
    key: 'sector',
    label: 'Sub-type',
    filter: 'values',
    filterId: 'sector',
    defaultHidden: true,
    width: '11%',
  },
  {
    key: 'region',
    label: 'Region',
    filter: 'values',
    filterId: 'region',
    width: '8%',
  },
  {
    key: 'currentPhaseName',
    // The phase is an object on the row: DEMI sorts by its name, and answers 400 for the bare key.
    sortKey: 'currentPhaseName.name',
    label: 'Phase',
    filter: 'values',
    filterId: 'currentPhaseName',
    filterHint: PROJECTS_ONLY,
    width: '10%',
  },
  // A notification's own fields; a project row leaves them blank.
  { key: 'decision', label: 'Decision', defaultHidden: true, width: '7%' },
  {
    key: 'notificationReceivedDate',
    label: 'Received',
    date: true,
    defaultHidden: true,
    width: '7%',
  },
];

/**
 * Projects and project notifications, one row each, from `/project-records`. Only the filters
 * below narrow; one a notification does not carry drops the notifications.
 */
export const projectsConfig: RecordTypeConfig = {
  id: 'projects',
  label: 'Projects',
  noun: (filters) =>
    [filters['recordKind']].flat().join() === 'notification' ? 'project notifications' : 'projects',
  kind: 'project-records',
  // DEMI orders a keyword's matches by name, as it does without one.
  scored: false,
  wire: {
    recordKind: 'recordKind',
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
    pcp: 'pcp',
    decision: 'decision',
  },
  // `/project-records` filters by the proponent's name; the URL holds the org id it stands for.
  wireLabels: (orgs: OptionSource[]) => ({ proponent: toOptions(orgs) }),
  defaultSort: PROJECTS_SORT,
  template: 'grid',
  columns: COLUMNS,
  advancedFields: [
    { id: 'recordKind', label: 'Project or notification', kind: 'select' },
    {
      id: 'dateUpdatedStart',
      label: 'Updated from',
      kind: 'date',
      placeholder: 'YYYY-MM-DD',
      hint: PROJECTS_ONLY,
    },
    {
      id: 'dateUpdatedEnd',
      label: 'Updated to',
      kind: 'date',
      placeholder: 'YYYY-MM-DD',
      hint: PROJECTS_ONLY,
    },
    // The Angular project list put these on the query string, so the redirect still carries them.
    {
      id: 'decisionDateStart',
      label: 'Decision from',
      kind: 'date',
      placeholder: 'YYYY-MM-DD',
      hint: PROJECTS_ONLY,
    },
    {
      id: 'decisionDateEnd',
      label: 'Decision to',
      kind: 'date',
      placeholder: 'YYYY-MM-DD',
      hint: PROJECTS_ONLY,
    },
    { id: 'eacDecision', label: 'EA decision', kind: 'select', hint: PROJECTS_ONLY },
    { id: 'CEAAInvolvement', label: 'Joint review with IAAC', kind: 'select', hint: PROJECTS_ONLY },
    { id: 'pcp', label: 'Comment period status', kind: 'select' },
    {
      id: 'decision',
      label: 'Notification decision',
      kind: 'select',
      hint: 'Shows project notifications only',
    },
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
      recordKind: toOptions(RECORD_KINDS),
      currentPhaseName: ofType(LIST_TYPES.currentPhaseName),
      eacDecision: ofType(LIST_TYPES.eacDecision),
      CEAAInvolvement: ofType(LIST_TYPES.CEAAInvolvement),
      // DEMI refuses `pcp=none` on this list.
      pcp: toOptions(
        (Constants.PCP_COLLECTION as OptionSource[]).filter((item) => item.code !== 'none'),
      ),
      decision: toOptions(Constants.PROJECT_NOTIFICATION_DECISIONS as OptionSource[]),
    };
  },
  // No lookup lists the sub-types, and `sector` matches the stored text exactly: offer the rows'.
  optionsFromRows: (rows) => ({ sector: rowValueOptions(rows, 'sector') }),
  selectable: false,
};
