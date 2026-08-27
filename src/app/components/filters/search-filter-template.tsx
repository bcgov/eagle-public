import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { track } from 'app/analytics/analytics';
import { CustomMultiSelect } from './custom-multi-select';
import { DatePicker } from './date-picker';
import {
  buildSearchPackage,
  FilterType,
  hasActiveFilters,
  initialFilterValues,
  type FilterObject,
  type FilterValues,
  type SearchPackage
} from './filter-object';
import './filters.css';

interface SearchFilterTemplateProps {
  title?: string;
  tooltip?: string;
  keywordWatermark?: string;
  advancedFilters?: boolean;
  showAdvancedFilters?: boolean;
  searchOnFilterChange?: boolean;
  filterItemPanelSize?: number;
  filters?: FilterObject[];
  /** Seeds the keyword box from a param the host owns (tab-scoped keywords). */
  keywordOverride?: string;
  searchHelpLink?: string | null;
  searching?: boolean;
  onSearch: (searchPackage: SearchPackage) => void;
  onToggleFiltersPanel?: (event: { showPanel: boolean }) => void;
  onFilterChange?: (values: FilterValues) => void;
  onResetControls?: () => void;
}

const RESERVED_PARAMS = ['currentPage', 'pageSize', 'sortBy', 'keywords'];

export function SearchFilterTemplate({
  title,
  tooltip,
  keywordWatermark,
  advancedFilters = false,
  showAdvancedFilters = false,
  searchOnFilterChange = true,
  filterItemPanelSize = 4,
  filters = [],
  keywordOverride = '',
  searchHelpLink = null,
  searching = false,
  onSearch,
  onToggleFiltersPanel,
  onFilterChange,
  onResetControls
}: SearchFilterTemplateProps) {
  const [searchParams] = useSearchParams();
  const [keywords, setKeywords] = useState(() => keywordOverride || searchParams.get('keywords') || '');
  const [values, setValues] = useState<FilterValues>({});
  const [showFiltersPanel, setShowFiltersPanel] = useState(showAdvancedFilters);
  const [lastShowAdvanced, setLastShowAdvanced] = useState(showAdvancedFilters);
  const previousKeywords = useRef(keywords);
  const seededFrom = useRef<FilterObject[] | null>(null);

  // The host opens the panel when the URL already carries a filter; follow it without an effect.
  if (lastShowAdvanced !== showAdvancedFilters) {
    setLastShowAdvanced(showAdvancedFilters);
    setShowFiltersPanel(showAdvancedFilters);
  }

  // Filters arrive asynchronously (orgs, lists). Seed the form off the URL the first time a
  // populated set shows up, and again only if the host swaps the filter set out.
  useEffect(() => {
    if (!advancedFilters || filters.length === 0 || seededFrom.current === filters) {
      return;
    }
    seededFrom.current = filters;
    const urlValues: FilterValues = {};
    for (const [key, value] of searchParams.entries()) {
      if (!RESERVED_PARAMS.includes(key)) {
        urlValues[key] = value;
      }
    }
    setValues(initialFilterValues(filters, urlValues));
  }, [advancedFilters, filters, searchParams]);

  function emitSearch(nextValues: FilterValues, nextKeywords: string): void {
    const searchPackage = buildSearchPackage(
      filters,
      nextValues,
      nextKeywords,
      nextKeywords !== previousKeywords.current
    );
    previousKeywords.current = nextKeywords;

    track('Search Executed', {
      search_term: searchPackage.keywords || '',
      has_keywords: !!searchPackage.keywords,
      keyword_count: searchPackage.keywords ? searchPackage.keywords.split(' ').length : 0,
      filter_count: Object.keys(searchPackage.filters).length,
      subset: null
    });

    onSearch(searchPackage);
  }

  function setValue(key: string, value: any): void {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    onFilterChange?.(nextValues);
    if (searchOnFilterChange) {
      emitSearch(nextValues, keywords);
    }
  }

  function toggleAdvancedFilters(): void {
    const showPanel = !showFiltersPanel;
    window.hj?.('event', 'SEARCH_TOGGLED');
    track('Filters Panel Toggled', { action: showPanel ? 'opened' : 'closed' });
    setShowFiltersPanel(showPanel);
    onToggleFiltersPanel?.({ showPanel });
  }

  function clearFilters(): void {
    window.hj?.('event', 'FILTERS_CLEARED');
    track('Filters Cleared', { had_keywords: !!keywords, had_filters: hasActiveFilters(values, keywords) });

    setValues({});
    setKeywords('');
    previousKeywords.current = '';
    onResetControls?.();
    onSearch({ keywords: '', keywordsChanged: false, subset: null, filters: {} });
  }

  return (
    <div className="search-filter-wrapper">
      {title && (
        <div className="row mb-3">
          <div className="col">
            <span className="keyword-search-text">{title}</span>
            {tooltip && (
              <span
                className="material-icons align-text-bottom ml-2"
                title={tooltip}
                aria-label="Icon that displays a tooltip when focused or hovered over"
              >
                help_outline
              </span>
            )}
          </div>
        </div>
      )}

      <div className="search-bar-section mb-4">
        <div className="row">
          <div className="col">
            <div className="input-group">
              <div className="search-input-wrapper position-relative">
                <input
                  type="text"
                  className="form-control data-hj-allow"
                  value={keywords}
                  onChange={event => setKeywords(event.target.value)}
                  onKeyUp={event => {
                    if (event.key === 'Enter') emitSearch(values, keywords);
                  }}
                  placeholder={keywordWatermark || 'Type keyword to search'}
                  aria-label={keywordWatermark || 'Type keyword to search'}
                  aria-describedby="basic-addon2"
                />
                {keywords.length > 0 && (
                  <button
                    className="search-clear-btn btn btn-link"
                    type="button"
                    title="Clear search"
                    onClick={() => {
                      setKeywords('');
                      emitSearch(values, '');
                    }}
                  >
                    <span className="material-icons">close</span>
                  </button>
                )}
              </div>
              <button
                className="btn btn-warning"
                type="button"
                onClick={() => emitSearch(values, keywords)}
                disabled={searching}
              >
                {searching ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <span className="material-icons">search</span>
                )}
                <span className="ms-2">{searching ? 'Searching...' : 'Search'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {(searchHelpLink || advancedFilters) && (
        <div className="action-buttons-section">
          <div className="row">
            <div className="col-sm-12 col-md-6 text-md-start text-center mb-md-0 mb-3">
              {searchHelpLink && (
                <Link
                  className="btn btn-primary d-inline-flex align-items-center"
                  to={searchHelpLink}
                  target="_blank"
                  rel="noopener"
                >
                  <span className="material-icons">info</span>
                  <span className="ms-2">Search Help</span>
                </Link>
              )}
            </div>
            <div className="col-sm-12 col-md-6 text-md-end text-center">
              {advancedFilters && (
                <button className="btn btn-primary" onClick={toggleAdvancedFilters}>
                  {showFiltersPanel ? 'Close' : 'Open'} Advanced Filters
                  <span className="material-icons align-middle">
                    {showFiltersPanel ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {advancedFilters && (
        <div className="advanced-filters-section">
          <div id="advancedFilterPanel" className="row border-bottom pb-3" hidden={!showFiltersPanel}>
            <form className="filter-form" noValidate onSubmit={event => event.preventDefault()}>
              <div className={`row${searching ? ' disable-div' : ''}`}>
                {filters.map(filter => (
                  <div
                    key={filter.id}
                    className={`pb-1 filter-panel col-md-${filter.itemPanelSize ?? filterItemPanelSize}`}
                  >
                    {filter.type === FilterType.DateRange && (
                      <div>
                        {filter.name && filter.name.length > 0 && (
                          <span className="control-label font-weight-bold">{filter.name}</span>
                        )}
                        <div className="row">
                          <div className="col-md-6 start-date-padding">
                            <label
                              htmlFor={filter.filterDefinition.startDateId}
                              className="control-label font-weight-bold"
                              tabIndex={0}
                            >
                              {filter.filterDefinition.startDateLabel}
                            </label>
                            <DatePicker
                              id={filter.filterDefinition.startDateId}
                              value={values[filter.filterDefinition.startDateId] ?? ''}
                              minDate={filter.filterDefinition.minDate}
                              maxDate={filter.filterDefinition.maxDate}
                              onChange={value => setValue(filter.filterDefinition.startDateId, value)}
                            />
                          </div>
                          <div className="col-md-6 end-date-padding">
                            <label
                              htmlFor={filter.filterDefinition.endDateId}
                              className="control-label font-weight-bold"
                              tabIndex={0}
                            >
                              {filter.filterDefinition.endDateLabel}
                            </label>
                            <DatePicker
                              id={filter.filterDefinition.endDateId}
                              value={values[filter.filterDefinition.endDateId] ?? ''}
                              minDate={filter.filterDefinition.minDate}
                              maxDate={filter.filterDefinition.maxDate}
                              onChange={value => setValue(filter.filterDefinition.endDateId, value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {filter.type === FilterType.MultiSelect && (
                      <div>
                        {filter.name && filter.name.length > 0 && (
                          <span className="control-label font-weight-bold" tabIndex={0}>
                            {filter.name}
                          </span>
                        )}
                        <div className="form-group">
                          <CustomMultiSelect
                            id={filter.name}
                            items={filter.filterDefinition.options ?? []}
                            selected={values[filter.id] ?? []}
                            bindLabel="name"
                            groupBy={filter.filterDefinition.group?.name ?? null}
                            placeholder={`Type ${filter.name}`}
                            onChange={selected => setValue(filter.id, selected)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </form>
            <div className="reset-button-container">
              <button
                className="btn btn-primary float-end"
                onClick={clearFilters}
                disabled={searching || !hasActiveFilters(values, keywords)}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
