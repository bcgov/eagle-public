import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Engagement } from 'app/api/commentperiod';
import { track } from 'app/analytics/analytics';

/** The Comment period filter's choices, in the order the select lists them. */
export const COMMENT_PERIOD_LABEL: Record<Engagement, string> = {
  open: 'Open now',
  upcoming: 'Upcoming',
};

export type ProjectSort = 'relevance' | 'name' | 'updated';

/** The Sort choices, in the order the select lists them. */
export const SORT_LABEL: Record<ProjectSort, string> = {
  relevance: 'Relevance',
  name: 'Name A-Z',
  updated: 'Recently updated',
};

/** A URL value only when it is one of the choices; anything else reads as unset. */
function parseChoice<T extends string>(value: string | null, labels: Record<T, string>): T | null {
  return value && Object.hasOwn(labels, value) ? (value as T) : null;
}

export interface FilterCriteria {
  regions: string[];
  phases: string[];
  types: string[];
  applicant: string | null;
  clFile: string | null;
  dispId: string | null;
  purpose: string | null;
  publishFrom: Date | null;
  publishTo: Date | null;
  /** Keep only projects whose comment period is in this state; null keeps every project. */
  commentPeriod: Engagement | null;
  /** List and pin order; null is Relevance, the order demi-search answered in. */
  sort: ProjectSort | null;
}

export const EMPTY_FILTERS: FilterCriteria = {
  regions: [],
  phases: [],
  types: [],
  applicant: null,
  clFile: null,
  dispId: null,
  purpose: null,
  publishFrom: null,
  publishTo: null,
  commentPeriod: null,
  sort: null,
};

function parseList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

/** An unreadable date reads as unset; an Invalid Date throws once written back to the URL. */
function parseDate(value: string | null): Date | null {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function parseFilters(params: URLSearchParams): FilterCriteria {
  return {
    regions: parseList(params.get('regions')),
    phases: parseList(params.get('phases')),
    types: parseList(params.get('types')),
    applicant: params.get('applicant') || null,
    clFile: params.get('clFile') || null,
    dispId: params.get('dispId') || null,
    purpose: params.get('purpose') || null,
    publishFrom: parseDate(params.get('publishFrom')),
    publishTo: parseDate(params.get('publishTo')),
    commentPeriod: parseChoice(params.get('cp'), COMMENT_PERIOD_LABEL),
    sort: parseChoice(params.get('sort'), SORT_LABEL),
  };
}

/** Only non-empty filters reach the URL, so a page with no filters carries no query string. */
export function filtersToParams(filters: FilterCriteria): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.regions.length > 0) params.set('regions', filters.regions.join(','));
  if (filters.phases.length > 0) params.set('phases', filters.phases.join(','));
  if (filters.types.length > 0) params.set('types', filters.types.join(','));
  if (filters.applicant) params.set('applicant', filters.applicant);
  if (filters.clFile) params.set('clFile', filters.clFile);
  if (filters.dispId) params.set('dispId', filters.dispId);
  if (filters.purpose) params.set('purpose', filters.purpose);
  if (filters.publishFrom)
    params.set('publishFrom', filters.publishFrom.toISOString().split('T')[0]);
  if (filters.publishTo) params.set('publishTo', filters.publishTo.toISOString().split('T')[0]);
  if (filters.commentPeriod) params.set('cp', filters.commentPeriod);
  if (filters.sort) params.set('sort', filters.sort);
  return params;
}

export function hasActiveFilters(filters: FilterCriteria): boolean {
  return countFilters(filters) > 0;
}

/** Selected regions, phases and types each count once per selection; the rest count once if set. */
export function countFilters(filters: FilterCriteria): number {
  return (
    filters.regions.length +
    filters.phases.length +
    filters.types.length +
    (filters.applicant ? 1 : 0) +
    (filters.clFile ? 1 : 0) +
    (filters.dispId ? 1 : 0) +
    (filters.publishFrom ? 1 : 0) +
    (filters.publishTo ? 1 : 0) +
    (filters.commentPeriod ? 1 : 0)
  );
}

/** One event per filter change, from the Filters panel or a region picked on the map. */
export function trackFiltersApplied(applied: FilterCriteria): void {
  track('Project Filters Applied', {
    regions_count: applied.regions.length,
    phases_count: applied.phases.length,
    types_count: applied.types.length,
    has_applicant: !!applied.applicant,
    has_cl_file: !!applied.clFile,
    has_disp_id: !!applied.dispId,
    has_date_range: !!(applied.publishFrom || applied.publishTo),
    comment_period: applied.commentPeriod ?? null,
    total_filters: countFilters(applied),
  });
}

/**
 * Project filters, stored in the URL query string. Updates replace the history entry so filtering
 * never fills the back button, and a shared link restores the same filters.
 */
export function useProjectFilters(): {
  filters: FilterCriteria;
  updateFilters: (next: Partial<FilterCriteria>) => void;
  clearFilters: () => void;
} {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const updateFilters = useCallback(
    (next: Partial<FilterCriteria>) => {
      setParams(filtersToParams({ ...parseFilters(params), ...next }), { replace: true });
    },
    [params, setParams],
  );

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { filters, updateFilters, clearFilters };
}
