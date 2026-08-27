import { useMemo, useState } from 'react';
import { CustomMultiSelect, type CustomMultiSelectOption } from 'app/components/filters/custom-multi-select';
import { Constants } from 'app/utils/constants';
import { track } from 'app/analytics/analytics';
import { countFilters, hasActiveFilters, type FilterCriteria } from './filter-state';
import './projlist-filters.css';

interface ProjlistFiltersProps {
  ref?: React.Ref<HTMLDivElement>;
  filters: FilterCriteria;
  updateFilters: (next: Partial<FilterCriteria>) => void;
  regions: CustomMultiSelectOption[];
  phases: CustomMultiSelectOption[];
  showSearchMobile: boolean;
  onToggleSearchMobile: () => void;
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

export function ProjlistFilters({
  ref,
  filters,
  updateFilters,
  regions,
  phases,
  showSearchMobile,
  onToggleSearchMobile
}: ProjlistFiltersProps) {
  const [showFilters, setShowFilters] = useState(() => hasActiveFilters(filters));
  // Kept locally so typing a space between words survives; only the trimmed value reaches the URL.
  const [applicantInput, setApplicantInput] = useState(filters.applicant ?? '');

  const selectedTypes = useMemo(() => optionsFor(filters.types, PROJECT_TYPES, 'code'), [filters.types]);
  const selectedRegions = useMemo(() => optionsFor(filters.regions, regions, '_id'), [filters.regions, regions]);
  const selectedPhases = useMemo(() => optionsFor(filters.phases, phases, '_id'), [filters.phases, phases]);

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

  function toggleFilters(): void {
    setShowFilters(open => {
      track('Project Filters Panel Toggled', { is_open: !open, current_filter_count: countFilters(filters) });
      return !open;
    });
  }

  return (
    <div className="app-filters" ref={ref}>
      <div className="app-filters__container d-flex flex-column">
        <button className="mobile-search-toggle" onClick={onToggleSearchMobile} aria-label="Toggle search">
          <i className="material-icons">{showSearchMobile ? 'close' : 'search'}</i>
        </button>
        <div className={`search-container${showSearchMobile ? ' show-mobile' : ''}`} id="applist-filters">
          <div className="additional-filters">
            <div className="mobile-header">
              <label className="header-label" htmlFor="applicantInput">
                Search Environmental Assessment Projects
              </label>
              <button type="button" className="btn-close" onClick={onToggleSearchMobile} aria-label="Close search"></button>
            </div>
            <div className="search-box position-relative">
              <input
                type="text"
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
            <div className="toggle-container">
              <div
                className="toggle-btn"
                role="button"
                tabIndex={0}
                onClick={toggleFilters}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleFilters();
                  }
                }}
                aria-expanded={showFilters}
              >
                <span>{showFilters ? 'Hide' : 'Show'} Advanced Filters</span>
                <i className="material-icons">{showFilters ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</i>
              </div>
            </div>
            {showFilters && (
              <div className="filters-container">
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
