import { useEffect, useId, useRef, useState } from 'react';
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
  type SearchPackage,
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
  /** 'filters' renders the redesigned tune-icon toggle; 'advanced' keeps the legacy label. */
  filterToggle?: 'advanced' | 'filters';
  onSearch: (searchPackage: SearchPackage) => void;
  onToggleFiltersPanel?: (event: { showPanel: boolean }) => void;
  onFilterChange?: (values: FilterValues) => void;
  onResetControls?: () => void;
}

const RESERVED_PARAMS = ['currentPage', 'pageSize', 'sortBy', 'keywords'];

/** Shortest keyword worth a round trip. One character matches most of the corpus. */
const MIN_TYPEAHEAD_LENGTH = 2;

const TYPEAHEAD_DEBOUNCE_MS = 300;

/** A pause this long means the word is finished, so the analytics event carries the whole term. */
const TYPEAHEAD_TRACK_MS = 1500;

/**
 * What a typed box searches for. Anything shorter than the minimum searches as an empty keyword:
 * backspacing to one character restores the unfiltered list instead of leaving the last results up.
 */
function typeaheadKeywords(keywords: string): string {
  return keywords.trim().length >= MIN_TYPEAHEAD_LENGTH ? keywords : '';
}

/** Keyword box and filter panel. Searches as the user types; Enter searches without the pause. */
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
  filterToggle = 'advanced',
  onSearch,
  onToggleFiltersPanel,
  onFilterChange,
  onResetControls,
}: SearchFilterTemplateProps) {
  const [searchParams] = useSearchParams();
  const hintId = `${useId()}-search-hint`;
  const [keywords, setKeywords] = useState(
    () => keywordOverride || searchParams.get('keywords') || '',
  );
  const [values, setValues] = useState<FilterValues>({});
  const [showFiltersPanel, setShowFiltersPanel] = useState(showAdvancedFilters);
  const [lastShowAdvanced, setLastShowAdvanced] = useState(showAdvancedFilters);
  const previousKeywords = useRef(keywords);
  const seededFrom = useRef<FilterObject[] | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A debounced search fires after the filter set and its values may have moved — the host loads
  // filters asynchronously — so it reads both from here rather than from what the keystroke's
  // handler closed over.
  const latestValues = useRef(values);
  const latestFilters = useRef(filters);
  // Records the search the track timer is waiting on, so leaving the page can still send it.
  const pendingTrack = useRef<(() => void) | null>(null);

  useEffect(() => {
    latestValues.current = values;
    latestFilters.current = filters;
  });

  useEffect(() => {
    return () => {
      const searchNeverRan = debounceTimer.current !== null;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (trackTimer.current) {
        clearTimeout(trackTimer.current);
        if (!searchNeverRan) pendingTrack.current?.();
      }
    };
  }, []);

  function cancelPendingSearch(): void {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (trackTimer.current) {
      clearTimeout(trackTimer.current);
      trackTimer.current = null;
    }
    pendingTrack.current = null;
  }

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

  function trackSearch(searchPackage: SearchPackage): void {
    track('Search Executed', {
      search_term: searchPackage.keywords || '',
      has_keywords: !!searchPackage.keywords,
      keyword_count: searchPackage.keywords ? searchPackage.keywords.split(' ').length : 0,
      filter_count: Object.keys(searchPackage.filters).length,
      subset: null,
    });
  }

  /** `tracked` is false for a typeahead search: every prefix of a word would be its own event. */
  function emitSearch(nextValues: FilterValues, nextKeywords: string, tracked = true): void {
    const searchPackage = buildSearchPackage(
      latestFilters.current,
      nextValues,
      nextKeywords,
      nextKeywords !== previousKeywords.current,
    );
    previousKeywords.current = nextKeywords;

    if (tracked) {
      trackSearch(searchPackage);
    }

    onSearch(searchPackage);
  }

  /** One event per finished word: armed on each keystroke, so only the last one survives. */
  function scheduleSearchTracking(nextKeywords: string): void {
    if (!nextKeywords) return;
    const send = () => {
      pendingTrack.current = null;
      trackTimer.current = null;
      trackSearch(
        buildSearchPackage(latestFilters.current, latestValues.current, nextKeywords, true),
      );
    };
    pendingTrack.current = send;
    trackTimer.current = setTimeout(send, TYPEAHEAD_TRACK_MS);
  }

  function setValue(key: string, value: any): void {
    // A search armed by an earlier keystroke carries the values from before this change, so it
    // would revert the filter the moment it fires.
    cancelPendingSearch();
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
    cancelPendingSearch();
    window.hj?.('event', 'FILTERS_CLEARED');
    track('Filters Cleared', {
      had_keywords: !!keywords,
      had_filters: hasActiveFilters(values, keywords),
    });

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
                  onChange={(event) => {
                    const nextKeywords = event.target.value;
                    setKeywords(nextKeywords);
                    cancelPendingSearch();
                    const searchFor = typeaheadKeywords(nextKeywords);
                    // Typing back to the term already on screen is not a new search, so it earns
                    // neither a request nor an event.
                    if (searchFor === previousKeywords.current) return;
                    debounceTimer.current = setTimeout(() => {
                      debounceTimer.current = null;
                      emitSearch(latestValues.current, searchFor, false);
                    }, TYPEAHEAD_DEBOUNCE_MS);
                    scheduleSearchTracking(searchFor);
                  }}
                  onKeyUp={(event) => {
                    if (event.key === 'Enter') {
                      cancelPendingSearch();
                      emitSearch(values, keywords);
                    }
                  }}
                  placeholder={keywordWatermark || 'Type keyword to search'}
                  aria-label={keywordWatermark || 'Type keyword to search'}
                  aria-describedby={hintId}
                />
                {keywords.length > 0 && (
                  <button
                    className="search-clear-btn btn btn-link"
                    type="button"
                    title="Clear search"
                    onClick={() => {
                      cancelPendingSearch();
                      setKeywords('');
                      emitSearch(values, '');
                    }}
                  >
                    <span className="material-icons">close</span>
                  </button>
                )}
              </div>
              <span id={hintId} className="visually-hidden">
                Results update as you type
              </span>
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
              {advancedFilters && filterToggle === 'filters' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={toggleAdvancedFilters}
                  aria-expanded={showFiltersPanel}
                  aria-controls="advancedFilterPanel"
                >
                  <span className="material-icons" aria-hidden="true">
                    tune
                  </span>
                  Filters
                </button>
              )}
              {advancedFilters && filterToggle === 'advanced' && (
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
          <div
            id="advancedFilterPanel"
            className="row border-bottom pb-3"
            hidden={!showFiltersPanel}
          >
            <form className="filter-form" noValidate onSubmit={(event) => event.preventDefault()}>
              <div className="row">
                {filters.map((filter) => (
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
                            >
                              {filter.filterDefinition.startDateLabel}
                            </label>
                            <DatePicker
                              id={filter.filterDefinition.startDateId}
                              value={values[filter.filterDefinition.startDateId] ?? ''}
                              minDate={filter.filterDefinition.minDate}
                              maxDate={filter.filterDefinition.maxDate}
                              onChange={(value) =>
                                setValue(filter.filterDefinition.startDateId, value)
                              }
                            />
                          </div>
                          <div className="col-md-6 end-date-padding">
                            <label
                              htmlFor={filter.filterDefinition.endDateId}
                              className="control-label font-weight-bold"
                            >
                              {filter.filterDefinition.endDateLabel}
                            </label>
                            <DatePicker
                              id={filter.filterDefinition.endDateId}
                              value={values[filter.filterDefinition.endDateId] ?? ''}
                              minDate={filter.filterDefinition.minDate}
                              maxDate={filter.filterDefinition.maxDate}
                              onChange={(value) =>
                                setValue(filter.filterDefinition.endDateId, value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {filter.type === FilterType.MultiSelect && (
                      <div>
                        {filter.name && filter.name.length > 0 && (
                          <span className="control-label font-weight-bold">{filter.name}</span>
                        )}
                        <div className="form-group">
                          <CustomMultiSelect
                            id={filter.name}
                            items={filter.filterDefinition.options ?? []}
                            selected={values[filter.id] ?? []}
                            bindLabel="name"
                            groupBy={filter.filterDefinition.group?.name ?? null}
                            placeholder={`Type ${filter.name}`}
                            onChange={(selected) => setValue(filter.id, selected)}
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
                disabled={!hasActiveFilters(values, keywords)}
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
