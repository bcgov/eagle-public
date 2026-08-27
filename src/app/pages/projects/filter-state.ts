import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

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
  publishTo: null
};

function parseList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function parseDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
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
    publishTo: parseDate(params.get('publishTo'))
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
  if (filters.publishFrom) params.set('publishFrom', filters.publishFrom.toISOString().split('T')[0]);
  if (filters.publishTo) params.set('publishTo', filters.publishTo.toISOString().split('T')[0]);
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
    (filters.publishTo ? 1 : 0)
  );
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
    [params, setParams]
  );

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { filters, updateFilters, clearFilters };
}
