import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { track } from 'app/analytics/analytics';
import { listsQueryOptions } from 'app/api/api';
import { proponentsQueryOptions } from 'app/api/org';
import { getSearchResults } from 'app/api/search';
import { AdvancedFilters } from 'app/components/display-grid/advanced-filters';
import { ChipRow, type GridChip } from 'app/components/display-grid/chip-row';
import { DisplayGrid } from 'app/components/display-grid/display-grid';
import { GridToolbar } from 'app/components/display-grid/grid-toolbar';
import type {
  AdvancedField,
  FilterValues,
  GridColumn,
  SortState,
  ValueOption,
} from 'app/components/display-grid/types';
import {
  parseGridParams,
  RECORD_TYPES,
  useGridUrlState,
  type RecordType,
  type SearchScope,
} from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import {
  CAP_MESSAGE,
  clearSelection,
  setSelected,
  startDownload,
  toggleSelected,
  toSize,
  useDownloadInProgress,
  useSelection,
  MAX_JOBS_IN_FLIGHT,
} from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import { mediumDate } from 'app/utils/utils';
import { recordConfig, type RecordTypeConfig, type SearchMeta } from './types';
import { PROJECTS_FALLBACK_SORT, PROJECTS_SORT, resolveSort } from './types/projects';
import { useTypeCounts } from './use-type-counts';
import './unified-search.css';

type Row = Record<string, unknown>;

/** Selection bucket name. The unified page is what `/search` selects documents from. */
const TABLE_ID = 'search';

/** Pill labels for the record types that have no config yet; the configured ones carry their own. */
const PENDING_LABELS: Partial<Record<RecordType, string>> = {
  activities: 'Activities & updates',
  notifications: 'Project notifications',
};

/** Inside-document search is Phase 4; until then the control has one option and states the scope. */
const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'names', label: 'Names & details' },
];

function recordLabel(record: RecordType): string {
  return recordConfig(record)?.label ?? PENDING_LABELS[record] ?? record;
}

/** `-datePosted` as the header reads it. */
function sortStateOf(sortBy: string): SortState | null {
  if (!sortBy) return null;
  const dir = sortBy.startsWith('-') ? 'desc' : 'asc';
  return { key: sortBy.replace(/^[+-]/, ''), dir };
}

/** Filters as the API takes them: raw ids, because `searchKeywords` is what wraps them as `and[]`. */
function toWireFilters(filters: FilterValues): Record<string, string> {
  const wire: Record<string, string> = {};
  for (const [id, value] of Object.entries(filters)) {
    const joined = Array.isArray(value) ? value.join(',') : value;
    if (joined) wire[id] = joined;
  }
  return wire;
}

/**
 * demi-search reports what it could not honour as `dropped: {filter: [], sort: []}`, while the
 * record configs read one flat list of field names. Flatten it here rather than teach both.
 */
function readMeta(entry: Record<string, unknown>): SearchMeta {
  const dropped = entry?.['dropped'];
  const names = Array.isArray(dropped)
    ? dropped
    : dropped && typeof dropped === 'object'
      ? Object.values(dropped as Record<string, unknown>).flatMap((group) =>
          Array.isArray(group) ? group : [],
        )
      : [];
  return {
    searchResultsTotal: entry?.['searchResultsTotal'] as number | undefined,
    dropped: names.map(String),
    degraded: entry?.['degraded'] as boolean | undefined,
  };
}

interface SearchPage {
  rows: Row[];
  total: number;
  meta?: SearchMeta[];
}

interface SearchRequest {
  keywords: string;
  dataset: string;
  sortBy: string;
  currentPage: number;
  pageSize: number;
  filters: Record<string, string>;
  record: RecordType;
}

/**
 * One page of results plus the envelope's `meta`, which `fetchData` drops and the projects tab
 * needs to learn whether its sort field survived the index.
 */
async function runSearch(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage> {
  const results = await getSearchResults(
    request.keywords,
    request.dataset,
    [],
    request.currentPage,
    request.pageSize,
    request.sortBy,
    {},
    false,
    null,
    request.filters,
    '',
    false,
    signal,
  );

  // An aborted request throws above, so nothing past this line runs for a search that was replaced.
  track('Search Executed', {
    search_term: request.keywords,
    has_keywords: !!request.keywords,
    keyword_count: request.keywords ? request.keywords.split(' ').length : 0,
    filter_count: Object.keys(request.filters).length,
    record: request.record,
    subset: null,
  });

  const envelope = results?.[0]?.data ?? {};
  const meta: SearchMeta[] | undefined = Array.isArray(envelope.meta)
    ? envelope.meta.map(readMeta)
    : undefined;
  return {
    rows: Array.isArray(envelope.searchResults) ? envelope.searchResults : [],
    total: meta?.[0]?.searchResultsTotal ?? 0,
    meta,
  };
}

/** Option label for a stored filter value, and the way back from a chip's text to that value. */
function labelOfValue(options: ValueOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function valueOfLabel(options: ValueOption[], label: string): string {
  return options.find((option) => option.label === label)?.value ?? label;
}

/** One stored pick as its name. Populated rows carry the whole record, bare ones carry the id. */
function pickText(options: ValueOption[], pick: unknown): string {
  if (pick && typeof pick === 'object') {
    const held = pick as Record<string, unknown>;
    return String(held['name'] ?? labelOfValue(options, String(held['_id'] ?? '')));
  }
  return labelOfValue(options, String(pick ?? ''));
}

/** A cell's stored value as the reader's words. A multi-value cell reads as a list. */
function optionText(options: ValueOption[], value: unknown): string {
  const picks = Array.isArray(value) ? value : [value];
  return picks
    .map((pick) => pickText(options, pick))
    .filter(Boolean)
    .join(', ');
}

/** A coded value reads as its name, a date as a date; anything else is the stored text. */
function cellRenderer(
  column: GridColumn<Row>,
  picks: ValueOption[] | undefined,
): ((row: Row) => string) | undefined {
  if (picks) return (row) => optionText(picks, row[column.key]);
  if (column.date) return (row) => mediumDate(row[column.key] as string);
  return undefined;
}

/**
 * The one search page: a keyword, a record type, and the shared display grid configured by that
 * type. Everything the reader chooses lives in the URL, so a view can be linked and shared.
 */
export function UnifiedSearch() {
  const { data: lists = [] } = useQuery(listsQueryOptions());
  const { data: orgs = [] } = useQuery(proponentsQueryOptions());

  /* The projects tab sorts by last updated where the index carries it, and says so only after a
     response has shown whether it does. */
  const [projectsSort, setProjectsSort] = useState(PROJECTS_SORT);

  const [panelOpen, setPanelOpen] = useState(false);

  // The record decides the default sort, which the grid state needs before it can be read.
  const [searchParams] = useSearchParams();
  const config: RecordTypeConfig | undefined = recordConfig(parseGridParams(searchParams).record);
  const defaultSort = config?.id === 'projects' ? projectsSort : config?.defaultSort;

  const {
    state,
    setKeyword,
    setRecord,
    setScope,
    setFilter,
    setSort,
    setPage,
    setPageSize,
    setHiddenColumns,
    clearAll,
  } = useGridUrlState({ defaultSort });

  const { record, keywords, scope, sortBy, currentPage, pageSize, hiddenColumns, filters } = state;

  /* The field holds what is being typed; the URL holds what has been searched for. Without the
     draft every keystroke would wait on the debounce before it showed up. */
  const [draft, setDraft] = useState(keywords);
  const [applied, setApplied] = useState(keywords);
  const [lastUrlKeyword, setLastUrlKeyword] = useState(keywords);
  if (keywords !== lastUrlKeyword) {
    setLastUrlKeyword(keywords);
    // A keyword this page did not write - Clear all, a chip, the back button - wins over the draft.
    if (keywords !== applied) setDraft(keywords);
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);

  function applyKeyword(typed: string): void {
    setApplied(typed.trim());
    setKeyword(typed);
  }

  function onKeywordInput(typed: string): void {
    setDraft(typed);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => applyKeyword(typed), TYPEAHEAD_DEBOUNCE_MS);
  }

  const { counts } = useTypeCounts(draft);

  const options = useMemo(
    () => config?.optionsFrom(lists, orgs) ?? {},
    // `optionsFrom` is a property of the config object, so the config identity is the dependency.
    [config, lists, orgs],
  );

  /* Every column of both configured types is sortable in the index, and the dropdown values only
     exist once the `List` and `Organization` reads land. */
  const columns: GridColumn<Row>[] = useMemo(
    () =>
      (config?.columns ?? [])
        .filter((column) => !hiddenColumns.includes(column.key))
        .map((column) => {
          const picks = options[column.filterId ?? column.key] ?? column.options;
          return {
            ...column,
            sortable: true,
            options: picks,
            // A values column stores ids; without the lookup the cell shows a raw ObjectId.
            render: column.render ?? cellRenderer(column, picks),
          };
        }),
    [config, hiddenColumns, options],
  );

  const advancedFields: AdvancedField[] = useMemo(
    () =>
      (config?.advancedFields ?? []).map((field) =>
        field.kind === 'select' ? { ...field, options: options[field.id] ?? field.options } : field,
      ),
    [config, options],
  );

  const searchTerm = typeaheadKeywords(keywords).trim();
  const wireFilters = useMemo(() => toWireFilters(filters), [filters]);

  const { data, isFetching } = useQuery({
    queryKey: [
      'unified-search',
      record,
      searchTerm,
      sortBy,
      currentPage,
      pageSize,
      JSON.stringify(wireFilters),
    ],
    queryFn: ({ signal }) =>
      runSearch(
        {
          keywords: searchTerm,
          dataset: config?.dataset ?? '',
          sortBy,
          currentPage,
          pageSize,
          filters: wireFilters,
          record,
        },
        signal,
      ),
    enabled: config !== undefined,
    placeholderData: keepPreviousData,
  });

  /* One way only. The answer to "did you drop dateUpdated" depends on the sort that was asked
     for, so moving back would re-ask with the field the index just refused, forever. */
  if (
    record === 'projects' &&
    projectsSort !== PROJECTS_FALLBACK_SORT &&
    data?.meta &&
    resolveSort(data.meta) === PROJECTS_FALLBACK_SORT
  ) {
    setProjectsSort(PROJECTS_FALLBACK_SORT);
  }

  // `keepPreviousData` holds the last answer across a record switch, which a type with no config
  // of its own must not inherit: it asked for nothing, so it shows nothing.
  const rows = config ? (data?.rows ?? []) : [];
  const total = config ? (data?.total ?? 0) : 0;

  const selectable = config?.selectable ?? false;
  const selection = useSelection(TABLE_ID);
  const downloadInProgress = useDownloadInProgress();
  const selectedIds = useMemo(() => [...selection.keys()], [selection]);

  function rowId(row: Row): string {
    return String(row['_id'] ?? '');
  }

  function rowLabel(row: Row): string {
    return String(row['displayName'] ?? row['name'] ?? rowId(row));
  }

  function toggleRow(row: Row): void {
    const accepted = toggleSelected(TABLE_ID, {
      id: rowId(row),
      displayName: rowLabel(row),
      size: toSize(row['internalSize']),
    });
    if (!accepted) showToast(CAP_MESSAGE, { type: 'warning' });
  }

  function toggleAllOnPage(pageRows: Row[]): void {
    const ids = pageRows.map(rowId);
    if (ids.length > 0 && ids.every((id) => selection.has(id))) {
      for (const row of pageRows) toggleRow(row);
      return;
    }
    const accepted = setSelected(
      TABLE_ID,
      pageRows.map((row) => ({
        id: rowId(row),
        displayName: rowLabel(row),
        size: toSize(row['internalSize']),
      })),
    );
    if (!accepted) showToast(CAP_MESSAGE, { type: 'warning' });
  }

  function switchRecord(next: RecordType): void {
    if (next === record) return;
    // Filters, sort and selection belong to one record type; the keyword carries across.
    clearSelection(TABLE_ID);
    setPanelOpen(false);
    setRecord(next);
  }

  function labelOfFilter(id: string): string {
    const column = (config?.columns ?? []).find((item) => (item.filterId ?? item.key) === id);
    if (column) return column.label;
    return advancedFields.find((field) => field.id === id)?.label ?? id;
  }

  const chips: GridChip[] = [];
  if (keywords) chips.push({ id: 'keywords', label: 'Search', value: keywords });
  for (const [id, value] of Object.entries(filters)) {
    const label = labelOfFilter(id);
    const picks = Array.isArray(value) ? value : [value];
    for (const pick of picks) {
      chips.push({ id, label, value: labelOfValue(options[id] ?? [], pick) });
    }
  }

  function removeChip(id: string, value?: string): void {
    if (id === 'keywords') {
      setDraft('');
      applyKeyword('');
      return;
    }
    const current = filters[id];
    if (value !== undefined && Array.isArray(current)) {
      const raw = valueOfLabel(options[id] ?? [], value);
      const next = current.filter((pick) => pick !== raw);
      setFilter(id, next.length > 0 ? next : null);
      return;
    }
    setFilter(id, null);
  }

  function clearEverything(): void {
    setDraft('');
    setApplied('');
    clearSelection(TABLE_ID);
    clearAll();
  }

  const advancedCount = advancedFields.filter((field) => filters[field.id] != null).length;
  const filterCount = Object.keys(filters).length;
  const noun = config ? config.label.toLowerCase() : recordLabel(record).toLowerCase();

  function emptyState(): ReactNode {
    if (!config) {
      return (
        <span className="unified-search__empty">
          <span className="unified-search__empty-title">Not available yet</span>
          <span className="unified-search__empty-detail">
            {recordLabel(record)} joins the search in a later release. Projects and documents are
            searchable now.
          </span>
        </span>
      );
    }
    const title = searchTerm
      ? `Nothing in ${noun} matches “${searchTerm}”`
      : filterCount > 0
        ? `No ${noun} match these filters`
        : `No ${noun} found`;
    const detail = searchTerm
      ? 'Other record types may still have matches — the counts above tell you which.'
      : filterCount === 1
        ? 'One filter is applied. Clearing it brings the rest back.'
        : filterCount > 1
          ? `${filterCount} filters are applied. Clearing them brings the rest back.`
          : '';
    return (
      <span className="unified-search__empty">
        <span className="unified-search__empty-title">{title}</span>
        {detail && <span className="unified-search__empty-detail">{detail}</span>}
        {(searchTerm || filterCount > 0) && (
          <button type="button" className="unified-search__empty-action" onClick={clearEverything}>
            Clear filters and search
          </button>
        )}
      </span>
    );
  }

  const scopeControl =
    config?.id === 'documents' ? (
      <div
        className="unified-search__scope"
        data-tour="scope"
        role="group"
        aria-label="Search documents by"
      >
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`unified-search__scope-option${
              scope === option.value ? ' unified-search__scope-option--on' : ''
            }`}
            aria-pressed={scope === option.value}
            onClick={() => setScope(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    ) : undefined;

  return (
    <div className="unified-search">
      <h1 className="unified-search__title">Search</h1>
      <p className="unified-search__intro">
        One search across projects, documents and updates. Switch record type without losing your
        search; each type brings its own columns, filters and controls from the same grid.
      </p>

      <div className="unified-search__field" data-tour="search">
        <i className="material-icons unified-search__field-icon" aria-hidden="true">
          search
        </i>
        <label className="unified-search__field-label">
          <span className="unified-search__visually-hidden">
            Search projects, documents and updates
          </span>
          <input
            type="search"
            className="unified-search__input"
            placeholder="Search projects, documents and updates"
            value={draft}
            onChange={(event) => onKeywordInput(event.target.value)}
          />
        </label>
      </div>

      <div className="unified-search__types-row">
        <div
          className="unified-search__types"
          data-tour="types"
          role="group"
          aria-label="Record type"
        >
          {RECORD_TYPES.map((id) => {
            const on = id === record;
            const count = counts?.[id];
            return (
              <button
                key={id}
                type="button"
                className={`unified-search__pill${on ? ' unified-search__pill--on' : ''}`}
                aria-pressed={on}
                onClick={() => switchRecord(id)}
              >
                {recordLabel(id)}
                {/* An unknown total renders no badge: a zero would claim the type has no matches. */}
                {typeof count === 'number' && (
                  <span className="unified-search__pill-count">
                    {count.toLocaleString('en-CA')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Link className="unified-search__help" to="/search-help">
          <i className="material-icons unified-search__help-icon" aria-hidden="true">
            help_outline
          </i>
          Search help
        </Link>
      </div>

      <DisplayGrid<Row>
        caption={`${recordLabel(record)} matching this search`}
        columns={columns}
        rows={rows}
        template={config?.template ?? 'grid'}
        rowComponent={config?.rowComponent}
        headerless={config?.headerless ?? false}
        loading={isFetching}
        emptyMessage={emptyState()}
        selectable={selectable}
        sort={sortStateOf(sortBy)}
        filters={filters}
        onSort={(key) => setSort(key, '+')}
        onFilterChange={(id, value) => setFilter(id, value)}
        page={currentPage}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowId={rowId}
        rowLabel={rowLabel}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAllOnPage={toggleAllOnPage}
        toolbar={
          <GridToolbar<Row>
            noun={noun}
            page={currentPage}
            pageSize={pageSize}
            total={total}
            scope={scopeControl}
            columns={config?.columns}
            hiddenColumns={hiddenColumns}
            onToggleColumn={(key) =>
              setHiddenColumns(
                hiddenColumns.includes(key)
                  ? hiddenColumns.filter((hidden) => hidden !== key)
                  : [...hiddenColumns, key],
              )
            }
            filterCount={advancedCount}
            panelOpen={panelOpen}
            onTogglePanel={config ? () => setPanelOpen((open) => !open) : undefined}
            selectedCount={selectable ? selection.size : 0}
            onClearSelection={() => clearSelection(TABLE_ID)}
            onDownload={() => void startDownload()}
            downloadDisabled={downloadInProgress}
            downloadTitle={
              downloadInProgress
                ? `${MAX_JOBS_IN_FLIGHT} downloads are already in progress. Wait for one to finish.`
                : undefined
            }
          />
        }
        chips={<ChipRow chips={chips} onRemove={removeChip} onClearAll={clearEverything} />}
        panel={(columnFilters) => (
          <AdvancedFilters
            // With columns on screen their filters live in the filter row, not here twice.
            fields={config?.headerless ? [...columnFilters, ...advancedFields] : advancedFields}
            values={filters}
            onChange={(id, value) => setFilter(id, value)}
            open={panelOpen}
          />
        )}
      />
    </div>
  );
}
