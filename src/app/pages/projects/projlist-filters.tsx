import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CustomMultiSelect, type CustomMultiSelectOption } from 'app/components/filters/custom-multi-select';
import { Constants } from 'app/utils/constants';
import { track } from 'app/analytics/analytics';
import { countFilters, EMPTY_FILTERS, type FilterCriteria } from './filter-state';
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
  key: '_id' | 'code'
): CustomMultiSelectOption[] {
  return ids.map(id => collection.find(item => item[key] === id)).filter((item): item is CustomMultiSelectOption => !!item);
}

export function ProjlistFilters({ filters, updateFilters, regions, phases }: ProjlistFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  // Kept locally so typing a space between words survives; only the trimmed value reaches the URL.
  const [applicantInput, setApplicantInput] = useState(filters.applicant ?? '');
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The search box has its own field, so the badge counts only the advanced filters.
  const activeCount = countFilters({ ...filters, applicant: null });
  const selectedTypes = useMemo(() => optionsFor(filters.types, PROJECT_TYPES, 'code'), [filters.types]);
  const selectedRegions = useMemo(() => optionsFor(filters.regions, regions, '_id'), [filters.regions, regions]);
  const selectedPhases = useMemo(() => optionsFor(filters.phases, phases, '_id'), [filters.phases, phases]);

  const setFiltersOpen = useCallback(
    (open: boolean) => {
      setShowFilters(open);
      track('Project Filters Panel Toggled', { is_open: open, current_filter_count: countFilters(filters) });
    },
    [filters]
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
    const applied = { ...filters, ...next };
    updateFilters(next);
    track('Project Filters Applied', {
      regions_count: applied.regions.length,
      phases_count: applied.phases.length,
      types_count: applied.types.length,
      has_applicant: !!applied.applicant,
      has_cl_file: !!applied.clFile,
      has_disp_id: !!applied.dispId,
      has_date_range: !!(applied.publishFrom || applied.publishTo),
      total_filters: countFilters(applied)
    });
  }

  return (
    <div className="projlist-filters">
      <div className="projlist-filters__bar">
        <label className="visually-hidden" htmlFor="applicantInput">
          Search Environmental Assessment Projects
        </label>
        <div className="projlist-filters__search">
          <i className="material-icons" aria-hidden="true">search</i>
          <input
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            className="form-control gtm-filter-applicant"
            placeholder="Start typing a project name"
            id="applicantInput"
            value={applicantInput}
            onChange={event => {
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
      <div id="applist-filters" className="filters-panel" data-open={showFilters} inert={!showFilters}>
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
                  onChange={selected => applyFilters({ types: selected.map(item => item['code']) })}
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
                  onChange={selected => applyFilters({ regions: selected.map(item => item['_id']) })}
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
                  onChange={selected => applyFilters({ phases: selected.map(item => item['_id']) })}
                />
              </div>
            </div>

            <div className="filters-panel__actions">
              <button
                type="button"
                className="btn btn-link"
                onClick={() => {
                  setApplicantInput('');
                  applyFilters(EMPTY_FILTERS);
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
