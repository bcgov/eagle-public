import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CustomMultiSelect,
  type CustomMultiSelectOption,
} from 'app/components/filters/custom-multi-select';
import { Constants } from 'app/utils/constants';
import { track } from 'app/analytics/analytics';
import type { Engagement } from 'app/api/commentperiod';
import {
  COMMENT_PERIOD_LABEL,
  countFilters,
  EMPTY_FILTERS,
  SORT_LABEL,
  trackFiltersApplied,
  type FilterCriteria,
  type ProjectSort,
} from './filter-state';
import './projlist-filters.css';

interface ProjlistFiltersProps {
  filters: FilterCriteria;
  updateFilters: (next: Partial<FilterCriteria>) => void;
  regions: CustomMultiSelectOption[];
  phases: CustomMultiSelectOption[];
}

const PROJECT_TYPES = Constants.PROJECT_TYPE_COLLECTION as CustomMultiSelectOption[];

/** Selected ids back to the option objects the multi-select renders; unknown ids drop out. */
function optionsFor(
  ids: string[],
  collection: CustomMultiSelectOption[],
  key: '_id' | 'code',
): CustomMultiSelectOption[] {
  return ids
    .map((id) => collection.find((item) => item[key] === id))
    .filter((item): item is CustomMultiSelectOption => !!item);
}

export function ProjlistFilters({ filters, updateFilters, regions, phases }: ProjlistFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  // Kept locally so typing a space between words survives; only the trimmed value reaches the URL.
  const [applicantInput, setApplicantInput] = useState(filters.applicant ?? '');
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The search box has its own field, so the badge counts only the advanced filters.
  const activeCount = countFilters({ ...filters, applicant: null });
  const selectedTypes = useMemo(
    () => optionsFor(filters.types, PROJECT_TYPES, 'code'),
    [filters.types],
  );
  const selectedRegions = useMemo(
    () => optionsFor(filters.regions, regions, '_id'),
    [filters.regions, regions],
  );
  const selectedPhases = useMemo(
    () => optionsFor(filters.phases, phases, '_id'),
    [filters.phases, phases],
  );

  const setFiltersOpen = useCallback(
    (open: boolean) => {
      setShowFilters(open);
      track('Project Filters Panel Toggled', {
        is_open: open,
        current_filter_count: countFilters(filters),
      });
    },
    [filters],
  );

  useEffect(() => {
    if (!showFilters) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setFiltersOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showFilters, setFiltersOpen]);

  function applyFilters(next: Partial<FilterCriteria>): void {
    updateFilters(next);
    trackFiltersApplied({ ...filters, ...next });
  }

  return (
    <div className="projlist-filters">
      <div className="projlist-filters__bar">
        <label className="visually-hidden" htmlFor="applicantInput">
          Search Environmental Assessment Projects
        </label>
        <div className="projlist-filters__search">
          <i className="material-icons" aria-hidden="true">
            search
          </i>
          <input
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            className="form-control gtm-filter-applicant"
            placeholder="Search projects"
            id="applicantInput"
            value={applicantInput}
            onChange={(event) => {
              setApplicantInput(event.target.value);
              applyFilters({ applicant: event.target.value.trim() || null });
            }}
          />
          {applicantInput && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setApplicantInput('');
                applyFilters({ applicant: null });
              }}
              aria-label="Clear search"
            >
              <i className="material-icons">close</i>
            </button>
          )}
        </div>

        <button
          type="button"
          className="projlist-filters__toggle"
          ref={toggleRef}
          onClick={() => setFiltersOpen(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="applist-filters"
        >
          <i className="material-icons" aria-hidden="true">
            tune
          </i>
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="badge" aria-label={`${activeCount} filters active`}>
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Always rendered: the open state is a grid-row transition, and `inert` keeps the collapsed
          filters out of the tab order. */}
      <div
        id="applist-filters"
        className="filters-panel"
        data-open={showFilters}
        inert={!showFilters}
      >
        <div className="filters-panel__inner">
          <div className="filters-panel__body">
            <div className="filter-container">
              <label htmlFor="type">Project Type</label>
              <div className="filter-select">
                <CustomMultiSelect
                  id="type"
                  bindLabel="name"
                  placeholder="Type Project Type"
                  items={PROJECT_TYPES}
                  selected={selectedTypes}
                  onChange={(selected) =>
                    applyFilters({ types: selected.map((item) => item['code']) })
                  }
                />
              </div>
            </div>
            <div className="filter-container">
              <label htmlFor="region">Region</label>
              <div className="filter-select">
                <CustomMultiSelect
                  id="region"
                  bindLabel="name"
                  placeholder="Type Project Region"
                  items={regions}
                  selected={selectedRegions}
                  onChange={(selected) =>
                    applyFilters({ regions: selected.map((item) => item['_id']) })
                  }
                />
              </div>
            </div>
            <div className="filter-container">
              <label htmlFor="phase">Project Phase</label>
              <div className="filter-select">
                <CustomMultiSelect
                  id="phase"
                  bindLabel="name"
                  groupBy="legislation"
                  placeholder="Type Project Phase"
                  items={phases}
                  selected={selectedPhases}
                  onChange={(selected) =>
                    applyFilters({ phases: selected.map((item) => item['_id']) })
                  }
                />
              </div>
            </div>
            <div className="filter-container">
              <label htmlFor="commentPeriod">Comment Period</label>
              <div className="filter-select">
                <select
                  id="commentPeriod"
                  className="form-select"
                  value={filters.commentPeriod ?? ''}
                  onChange={(event) =>
                    applyFilters({ commentPeriod: (event.target.value as Engagement) || null })
                  }
                >
                  <option value="">Any</option>
                  {Object.entries(COMMENT_PERIOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filters-panel__actions">
              <button
                type="button"
                className="btn btn-link"
                onClick={() => {
                  setApplicantInput('');
                  // The order is a view choice, not a filter, so it survives.
                  applyFilters({ ...EMPTY_FILTERS, sort: filters.sort });
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProjlistSortProps {
  sort: ProjectSort;
  onChange: (sort: ProjectSort) => void;
}

export function ProjlistSort({ sort, onChange }: ProjlistSortProps) {
  return (
    <label className="projlist-sort">
      Sort
      <select
        className="form-select form-select-sm"
        value={sort}
        onChange={(event) => onChange(event.target.value as ProjectSort)}
      >
        {(Object.entries(SORT_LABEL) as [ProjectSort, string][]).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
