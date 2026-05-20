/**
 * Shared collection configs, types, and utilities for unified Typesense search.
 *
 * Single source of truth for:
 *  - Collection IDs, index names, query parameters
 *  - Facet definitions (attribute, heading, operator, limit, sorter)
 *  - Date facet definitions
 *  - Sort options (activities only)
 *  - Shared utilities: mergeItems, groupByLegislation, sortByName, sortByPhaseOrder, highlightField
 */

// ── Shared display types ───────────────────────────────────────────────────────

export interface DisplayItem {
  label: string;
  /** IS.js escapedValue — passed to rs.refine(). Equals label for most values; differs only for values starting with '-'. */
  value: string;
  count: number;
  isRefined: boolean;
  isDisabled: boolean;
}

export interface LegislationGroup {
  year: number;
  heading: string; // e.g. "2018 Act Terms", "" for ungrouped
  items: DisplayItem[];
}

// ── Collection config types ────────────────────────────────────────────────────

export type CollectionId = 'projects' | 'documents' | 'activities' | 'notifications' | 'document_chunks';
export type Tab = CollectionId | 'updates' | 'content';
export const VALID_TABS: Tab[] = ['projects', 'documents', 'updates', 'notifications', 'content'];

export interface FacetDef {
  attribute: string;
  heading: string;
  operator: 'and' | 'or';
  limit: number;
  sorter: (a: DisplayItem, b: DisplayItem) => number;
  /** listType matches ConfigService.lists[].type — used to build legislation lookup for documents */
  listType?: string;
  /** When true, facet items are grouped by legislation year (documents only) */
  grouped?: boolean;
}

export interface DateFacetDef {
  field: string;
  heading: string;
  fromLabel: string;
  toLabel: string;
}

export interface SortOption {
  label: string;
  value: string;
}

export interface CollectionConfig {
  indexName: string;
  queryBy: string;
  queryByWeights: string;
  hitsPerPage: number;
  defaultSortBy: string;
  facets: readonly FacetDef[];
  dateFacet?: DateFacetDef;
  sortOptions?: readonly SortOption[];
  placeholder: string;
}

// ── Shared sorters ─────────────────────────────────────────────────────────────

export const sortByName = (a: DisplayItem, b: DisplayItem): number =>
  a.label.localeCompare(b.label);

/** Canonical project phase order — 2002 Act first, 2018 Act second. */
const PHASE_ORDER: readonly string[] = [
  // 2002 Act
  'Pre-EA', 'Pre-Application', 'Evaluation', 'Application Review', 'Further Assessment',
  'Referral', 'Termination', 'Withdrawal',
  'Post Decision - Pre-Construction', 'Post Decision - Construction',
  'Post Decision - Operation', 'Post Decision - Care & Maintenance',
  'Post Decision - Decommission', 'Post Decision - Complete',
  'Post Decision - Amendment', 'Post Decision - Extension',
  'Post Decision - Substantial Start', 'Post Decision - Suspension',
  // 2018 Act
  'Project Designation', 'Early Engagement', 'Readiness Decision', 'Process Planning',
  'Application Development and Review', 'Effects Assessment', 'Complete', 'Other',
];

export function sortByPhaseOrder(a: DisplayItem, b: DisplayItem): number {
  const ai = PHASE_ORDER.indexOf(a.label);
  const bi = PHASE_ORDER.indexOf(b.label);
  if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

// ── mergeItems ─────────────────────────────────────────────────────────────────

/**
 * Merges fresh refinement list items into a master map (stale-while-revalidate).
 * Items absent from fresh results get count=0 and isDisabled=true (unless still selected).
 */
export function mergeItems(
  masterMap: Map<string, DisplayItem>,
  newItems: { label: string; value?: string; count: number; isRefined: boolean }[],
  sorter: (a: DisplayItem, b: DisplayItem) => number = sortByName,
): DisplayItem[] {
  for (const [key, item] of masterMap) {
    masterMap.set(key, { ...item, count: 0, isDisabled: !item.isRefined });
  }
  for (const item of newItems) {
    masterMap.set(item.label, {
      label: item.label, value: item.value ?? item.label, count: item.count, isRefined: item.isRefined, isDisabled: false,
    });
  }
  return Array.from(masterMap.values()).sort(sorter);
}

// ── groupByLegislation ─────────────────────────────────────────────────────────

const LEG_ORDER = [2002, 2018, 1996];

/**
 * Groups facet items by legislation year (2002/2018/1996 Act) using lookup from ConfigService.lists.
 * Items with no legislation mapping fall into the "ungrouped" bucket (year=0).
 */
export function groupByLegislation(
  items: DisplayItem[],
  lookup: Map<string, number>,
  sorter: (a: DisplayItem, b: DisplayItem) => number = sortByName,
): LegislationGroup[] {
  const buckets = new Map<number, DisplayItem[]>();
  for (const item of items) {
    const year = lookup.get(item.label) ?? 0;
    if (!buckets.has(year)) buckets.set(year, []);
    buckets.get(year)!.push(item);
  }
  for (const list of buckets.values()) list.sort(sorter);

  const result: LegislationGroup[] = [];
  for (const year of LEG_ORDER) {
    if (buckets.has(year)) {
      result.push({ year, heading: `${year} Act Terms`, items: buckets.get(year)! });
      buckets.delete(year);
    }
  }
  for (const [year, list] of buckets.entries()) {
    result.push({ year, heading: year > 0 ? `${year} Act Terms` : '', items: list });
  }
  return result;
}

// ── highlightField ─────────────────────────────────────────────────────────────

/**
 * Returns the Typesense highlight snippet for `field` if available,
 * otherwise falls back to the raw field value from the hit.
 */
export function highlightField(hit: any, field: string): string {
  return (hit['_highlightResult']?.[field]?.value ?? hit[field]) ?? '';
}

// ── Collection definitions ─────────────────────────────────────────────────────

export const COLLECTIONS: Record<CollectionId, CollectionConfig> = {
  projects: {
    indexName: 'projects',
    queryBy: 'name,displayName,description,epicProjectId,proponent',
    queryByWeights: '9000,8500,8000,3000,1000',
    hitsPerPage: 20,
    defaultSortBy: '',
    placeholder: 'Search projects by name, description, proponent…',
    facets: [
      { attribute: 'region',           heading: 'Region',      operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'type',             heading: 'Type',        operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'currentPhaseName', heading: 'Phase',       operator: 'or', limit: 50,  sorter: sortByPhaseOrder },
      { attribute: 'eacDecision',      heading: 'EA Decision', operator: 'or', limit: 100, sorter: sortByName },
    ],
    dateFacet: { field: 'decisionDate', heading: 'Decision Date', fromLabel: 'From', toLabel: 'To' },
  },

  documents: {
    indexName: 'documents',
    queryBy: 'displayName,documentFileName,description,projectName',
    queryByWeights: '8500,5000,8000,3000',
    hitsPerPage: 20,
    defaultSortBy: '',
    placeholder: 'Search documents by name, file name, project…',
    facets: [
      { attribute: 'type',               heading: 'Type',          operator: 'or', limit: 100, sorter: sortByName,        listType: 'doctype',      grouped: true },
      { attribute: 'milestone',          heading: 'Milestone',     operator: 'or', limit: 100, sorter: sortByName,        listType: 'label',        grouped: true },
      { attribute: 'documentAuthorType', heading: 'Author Type',   operator: 'or', limit: 100, sorter: sortByName,        listType: 'author',       grouped: true },
      { attribute: 'projectPhase',       heading: 'Project Phase', operator: 'or', limit: 100, sorter: sortByPhaseOrder,  listType: 'projectPhase', grouped: true },
    ],
    dateFacet: { field: 'datePosted', heading: 'Date Posted', fromLabel: 'From', toLabel: 'To' },
  },

  activities: {
    indexName: 'activities',
    queryBy: 'headline,content,notificationName',
    queryByWeights: '9000,8000,3000',
    hitsPerPage: 20,
    defaultSortBy: 'pinned:desc,dateAdded:desc',
    placeholder: 'Search news by headline, content, project…',
    facets: [
      { attribute: 'type', heading: 'Activity Type', operator: 'or', limit: 50, sorter: sortByName },
    ],
    sortOptions: [
      { label: 'Pinned First', value: 'pinned:desc,dateAdded:desc' },
      { label: 'Newest First', value: 'dateAdded:desc' },
      { label: 'Relevance',    value: '_text_match:desc,dateAdded:desc' },
    ],
  },

  notifications: {
    indexName: 'notifications',
    queryBy: 'name,description,proponent,subType,associatedProjectName,region,location',
    queryByWeights: '9000,8000,3000,2500,2000,1500,1000',
    hitsPerPage: 20,
    defaultSortBy: 'notificationReceivedDate:desc',
    placeholder: 'Search notifications by name, proponent, project…',
    facets: [
      { attribute: 'type',     heading: 'Project Type',        operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'subType',  heading: 'Sub-Type',            operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'region',   heading: 'Region',              operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'decision', heading: 'Decision',            operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'trigger',  heading: 'Notification Trigger', operator: 'or', limit: 100, sorter: sortByName },
      { attribute: 'pcp',      heading: 'Comment Period',      operator: 'or', limit: 10,  sorter: sortByName },
    ],
    dateFacet: { field: 'notificationReceivedDate', heading: 'Date Received', fromLabel: 'From', toLabel: 'To' },
  },

  document_chunks: {
    indexName: 'document_chunks',
    queryBy: 'content',
    queryByWeights: '9000',
    hitsPerPage: 20,
    defaultSortBy: '',
    placeholder: 'Search PDF document text…',
    facets: [
      { attribute: 'documentType', heading: 'Document Type', operator: 'or', limit: 100, sorter: sortByName },
    ],
    dateFacet: { field: 'datePosted', heading: 'Date Posted', fromLabel: 'From', toLabel: 'To' },
  },
};

// ── Per-tab Typesense filter strings ──────────────────────────────────────────
// Applied as base filter_by for Application / Certificate / Amendment tabs.
// These mirror the MongoDB createProjectTabModifiers() type/milestone lookups,
// but use the human-readable names stored in Typesense (already resolved by sync).

export const TAB_FILTER_BY: Record<string, string> = {
  application: `type:=["Application Materials","Scientific Memo","Independent Memo"] && milestone:=["Application Review","EAC Application","Revised EAC Application"]`,
  certificate: `type:=["Certificate Package","Order","Decision Materials"] && milestone:=["Certificate","Certificate Decision","Decision","Certificate Extension","Transfer of Certificate/Order"]`,
  amendment:   `type:=["Amendment Package","Request","Decision Materials","Tracking Table"] && milestone:=["Amendment"] && projectPhase:=["Post Decision - Amendment"]`,
};

// ── Per-tab facet subsets (no documentAuthorType) ──────────────────────────────

export const TAB_FACETS: Record<string, readonly FacetDef[]> = {
  // all 4 facets: type, milestone, documentAuthorType, projectPhase
  documents: COLLECTIONS.documents.facets as FacetDef[],
  // type + milestone + projectPhase
  application: COLLECTIONS.documents.facets.filter(f =>
    ['type', 'milestone', 'projectPhase'].includes(f.attribute)
  ) as FacetDef[],
  // type + milestone only
  certificate: COLLECTIONS.documents.facets.filter(f =>
    ['type', 'milestone'].includes(f.attribute)
  ) as FacetDef[],
  // type + milestone + projectPhase
  amendment: COLLECTIONS.documents.facets.filter(f =>
    ['type', 'milestone', 'projectPhase'].includes(f.attribute)
  ) as FacetDef[],
};

// ── Table-view column definitions ──────────────────────────────────────────────

import type { IColumnObject } from 'app/shared/components/table-template/table-object';

export type TableTab = 'projects' | 'documents' | 'updates' | 'notifications';
export const TABLE_TABS: { id: TableTab; label: string }[] = [
  { id: 'projects',      label: 'Projects'      },
  { id: 'documents',     label: 'Documents'     },
  { id: 'updates',       label: 'Updates'       },
  { id: 'notifications', label: 'Notifications' },
];

export interface SearchTableDef {
  columns: IColumnObject[];
  defaultSort: string;           // URL format: '+name', '-datePosted'
  /** Maps URL sortBy field name → Typesense sort field name (when different). */
  sortFieldMap: Record<string, string>;
  filterList: string[];          // facet attribute names used as URL params
  dateFilterList: string[];      // date URL param names (start/end)
}

export const SEARCH_TABLE_DEFS: Record<TableTab, SearchTableDef> = {
  projects: {
    columns: [
      { name: 'Name',     value: 'name',             width: 'col-2' },
      { name: 'Proponent', value: 'proponent',       width: 'col-2' },
      { name: 'Type',     value: 'type',             width: 'col-2' },
      { name: 'Region',   value: 'region',           width: 'col-2' },
      { name: 'Phase',    value: 'currentPhaseName', width: 'col-2' },
      { name: 'Decision', value: 'eacDecision',      width: 'col-2' },
    ],
    defaultSort: '-updatedDate',
    sortFieldMap: {},
    filterList: ['region', 'type', 'currentPhaseName', 'eacDecision'],
    dateFilterList: ['decisionDateStart', 'decisionDateEnd'],
  },
  documents: {
    columns: [
      { name: 'Document Name', value: 'displayName', width: 'col-3' },
      { name: 'Project',       value: 'projectName', width: 'col-2' },
      { name: 'Date',          value: 'datePosted',  width: 'col-2' },
      { name: 'Type',          value: 'type',        width: 'col-2' },
      { name: 'Milestone',     value: 'milestone',   width: 'col-2' },
      { name: '',              value: 'download',    width: 'col-1', nosort: true },
    ],
    defaultSort: '-datePosted',
    sortFieldMap: {},
    filterList: ['type', 'milestone', 'documentAuthorType', 'projectPhase'],
    dateFilterList: ['datePostedStart', 'datePostedEnd'],
  },
  updates: {
    columns: [
      { name: 'Headline', value: 'headline',    width: 'col-4', nosort: true },
      { name: 'Project',  value: 'projectName', width: 'col-3', nosort: true },
      { name: 'Type',     value: 'type',        width: 'col-2', nosort: true },
      { name: 'Date',     value: 'dateAdded',   width: 'col-3' },
    ],
    defaultSort: '-dateAdded',
    sortFieldMap: {},
    filterList: ['type'],
    dateFilterList: [],
  },
  notifications: {
    columns: [
      { name: 'Name',     value: 'name',                     width: 'col-3' },
      { name: 'Type',     value: 'type',                     width: 'col-2' },
      { name: 'Sub-Type', value: 'subType',                  width: 'col-2' },
      { name: 'Region',   value: 'region',                   width: 'col-2' },
      { name: 'Date',     value: 'notificationReceivedDate',  width: 'col-3' },
    ],
    defaultSort: '-notificationReceivedDate',
    sortFieldMap: {},
    filterList: ['type', 'subType', 'region', 'decision', 'trigger', 'pcp'],
    dateFilterList: ['notificationReceivedDateStart', 'notificationReceivedDateEnd'],
  },
};

/** Maps a Tab value to a CollectionId. */
export function tabToCollectionId(tab: Tab): CollectionId | null {
  if (tab === 'updates') return 'activities';
  if (tab === 'content') return 'document_chunks';
  return tab as CollectionId;
}

/** Converts an ISO date string (yyyy-mm-dd) to a Unix timestamp (seconds). */
export function isoToUnixTimestamp(iso: string, endOfDay = false): number {
  return Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 1000) + (endOfDay ? 86399 : 0);
}

/** Rewrites old project-notifications legacy URLs to the new unified search route.
 *  Also normalises bare-domain URLs (e.g. "www.example.com") by prepending "https://". */
export function resolveDocUrl(url: string): string {
  if (!url) return url;
  // Normalise bare-domain URLs that have no scheme (not starting with / or a known scheme).
  let normalised = url;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && /\.[a-z]{2,}/i.test(url)) {
    normalised = 'https://' + url;
  }
  try {
    const u = new URL(normalised, 'http://x');
    if (/\/project-notifications(?:\?|$)/.test(u.pathname)) {
      const q = u.searchParams.get('keywords') ?? '';
      return '/search?tab=notifications' + (q ? '&q=' + encodeURIComponent(q) : '');
    }
  } catch { /* not parseable */ }
  return normalised;
}
