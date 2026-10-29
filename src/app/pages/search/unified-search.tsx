import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { track } from 'app/analytics/analytics';
import { listsQueryOptions } from 'app/api/api';
import { proponentsQueryOptions } from 'app/api/org';
import { reachableTotal } from 'app/api/document';
import {
  kindTotal,
  passagePage,
  searchPage,
  type PassageGroup,
  type SearchFilters,
  type SearchKind,
} from 'app/api/unified-search';
import { AdvancedFilters } from 'app/components/display-grid/advanced-filters';
import { ChipRow, type GridChip } from 'app/components/display-grid/chip-row';
import { DisplayGrid, type SortOption } from 'app/components/display-grid/display-grid';
import {
  columnFiltersForPanel,
  optionLabel,
  sortStateOf,
} from 'app/components/display-grid/grid-helpers';
import { GridToolbar } from 'app/components/display-grid/grid-toolbar';
import { GuidedTour } from 'app/components/display-grid/guided-tour';
import { toTerms } from 'app/components/display-grid/highlight';
import type { ListRowField } from 'app/components/display-grid/list-row';
import {
  PassageList,
  type PassageHit,
  type PassageRow,
} from 'app/components/display-grid/passage-list';
import { SearchHelpDialog } from 'app/components/display-grid/search-help-dialog';
import type {
  AdvancedField,
  FilterValues,
  GridColumn,
  ValueOption,
} from 'app/components/display-grid/types';
import {
  INSIDE_SORT,
  parseGridParams,
  RECORD_TYPES,
  RELEVANCE_SORT,
  useGridUrlState,
  type RecordType,
  type SearchScope,
} from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { contentSearchEnabled, getNotifyApi } from 'app/config/config';
import { PageMasthead } from 'app/layout/page-masthead';
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
import { isSafeUrl } from 'app/utils/safe-url';
import { documentDownloadUrl } from 'app/utils/utils';
import {
  takesFilter,
  toNativeFilters,
  typedText,
  withRowOptions,
  yearOptions,
} from './search-filters';
import {
  recordConfig,
  type OptionSource,
  type RecordTypeConfig,
  type SearchColumn,
  type SearchContext,
} from './types';
import { isoDay } from './types/activities';
import { optionText, withCells } from './types/cells';
import { useSettled } from './use-settled';
import { useTypeCounts } from './use-type-counts';
import './unified-search.css';

type Row = Record<string, unknown>;

/** Selection bucket name. The unified page is what `/search` selects documents from. */
const TABLE_ID = 'search';

const SEARCH_LABEL = 'Search projects, documents, updates and comment periods';
/** The full label is cut off in a 390px-wide field; the short hint fits, the label stays for screen readers. */
const SEARCH_PLACEHOLDER = 'Search projects and more';

/** Where the record type and scope sit in the search query key; the placeholder reads them back. */
const RECORD_IN_KEY = 1;
const SCOPE_IN_KEY = 2;

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'names', label: 'Names & details' },
  { value: 'inside', label: 'Inside documents' },
];

const INSIDE_SORT_OPTIONS: SortOption[] = [{ value: INSIDE_SORT, label: 'Most matches' }];

/** One empty page, so options read off the rows are not rebuilt on every render while none land. */
const NO_ROWS: Row[] = [];
/** Likewise for a lookup read still in flight or failed, so the options built from it hold still. */
const NO_SOURCES: OptionSource[] = [];

/** The filters `/documents/passages` takes: the four `List` refs stamped on every passage. */
const PASSAGE_WIRE: Record<string, string> = {
  type: 'typeId',
  milestone: 'milestoneId',
  projectPhase: 'projectPhaseId',
  documentAuthorType: 'documentAuthorTypeId',
};

/** The URL filters a list can answer; the rest come back on the way out of it. */
function filtersFor(wire: Record<string, string>, values: FilterValues): FilterValues {
  return Object.fromEntries(Object.entries(values).filter(([id]) => takesFilter(wire, id)));
}

/** The API wraps each hit in `<mark>`; the passage list marks the terms itself, from plain text. */
const MARK_TAG = /<\/?mark>/g;

/** A passage as the list shows it: named by its page where it has one, otherwise by its place. */
function toHit(passage: PassageGroup['passages'][number], index: number): PassageHit {
  const hit: PassageHit = {
    locator: index + 1,
    text: passage.snippet.replace(MARK_TAG, '').trim(),
  };
  const page = Number(passage.pageNumber);
  // Only a document extracted with page markers carries a page worth linking to.
  if (passage.pageNumbered && Number.isInteger(page) && page > 0) {
    hit.locator = page;
    hit.pageNumbered = true;
  }
  return hit;
}

/** One document's passages on this page, in rank order, as the passage list reads them. */
function toPassageRow(row: Row): PassageRow {
  const group = row as unknown as PassageGroup;
  const name = group.displayName || 'Untitled document';
  const href = documentDownloadUrl({ _id: group.documentId, displayName: name });
  const passages = group.passages.map(toHit);
  return {
    id: group.documentId,
    name,
    href: isSafeUrl(href) ? href : '',
    date: isoDay(group.datePosted) || null,
    type: group.type ?? null,
    author: null,
    passages,
    total: passages.length,
  };
}

function recordLabel(record: RecordType): string {
  return recordConfig(record).label;
}

interface SearchRequest {
  record: RecordType;
  kind: SearchKind;
  inside: boolean;
  keywords: string;
  sortBy: string;
  currentPage: number;
  pageSize: number;
  filters: SearchFilters;
}

/** The name DEMI sorts a column by, which a nested field spells longer than the column key. */
function sortKeyOf(columns: readonly SearchColumn[], key: string): string {
  return columns.find((column) => column.key === key)?.sortKey ?? key;
}

/** The column a DEMI sort name stands for, so its header shows the sort. */
function columnKeyOf(columns: readonly SearchColumn[], key: string): string {
  return columns.find((column) => column.sortKey === key)?.key ?? key;
}

/** A sort under the name DEMI takes, whichever of a column's two names the address holds. */
function withSortKey(columns: readonly SearchColumn[], sortBy: string): string {
  return sortBy.replace(/^([+-]?)(.*)$/, (_, sign: string, key: string) => {
    return sign + sortKeyOf(columns, key);
  });
}

/** The sort as the grid reads it, keyed by the column it sorts. */
function headerSort(columns: readonly SearchColumn[], sortBy: string) {
  const sort = sortStateOf(sortBy);
  return sort && { ...sort, key: columnKeyOf(columns, sort.key) };
}

/** `+name` and `-name` as DEMI spells them; relevance is the order a `q` read has unsorted. */
function nativeSort(sortBy: string): string | undefined {
  if (sortBy === RELEVANCE_SORT) return undefined;
  return sortBy.replace(/^\+/, '');
}

/** One page of the tab's rows, or of passages grouped under their document. */
async function runSearch(request: SearchRequest, signal?: AbortSignal) {
  const { record, kind, inside, keywords, currentPage: page, pageSize, filters } = request;
  const result = inside
    ? await passagePage({ q: keywords, page, pageSize, filters }, signal)
    : await searchPage(
        kind,
        { page, pageSize, q: keywords || undefined, sort: nativeSort(request.sortBy), filters },
        signal,
      );

  // An aborted request throws above, so nothing past this line runs for a search that was replaced.
  track('Search Executed', {
    search_term: keywords,
    has_keywords: !!keywords,
    keyword_count: keywords ? keywords.split(' ').length : 0,
    filter_count: Object.keys(filters).length,
    record,
    subset: null,
  });
  return { rows: result.rows as unknown as Row[], total: result.total };
}

/** Whether a list can sort by `sortBy`: a sortable column, or one of its sort options. */
function sortsBy(
  columns: readonly SearchColumn[],
  sortOptions: readonly SortOption[] | undefined,
  sortBy: string,
): boolean {
  const key = columnKeyOf(columns, sortBy.replace(/^[+-]/, ''));
  return (
    columns.some((column) => column.sortable !== false && column.key === key) ||
    !!sortOptions?.some((option) => option.value === sortBy)
  );
}

/** Option label for a stored filter value, with its Act where it has one. */
function labelOfValue(options: ValueOption[], value: string): string {
  const option = options.find((item) => item.value === value);
  return option ? optionLabel(option) : value;
}

/** A filter value as one string; a multi-select holds a list, a year holds one. */
function asFilterText(value: FilterValues[string] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

/**
 * The one search page: a keyword, a record type, and the shared display grid configured by that
 * type. Everything the reader chooses lives in the URL, so a view can be linked and shared.
 */
export function UnifiedSearch() {
  const { data: lists = NO_SOURCES } = useQuery(listsQueryOptions());
  const { data: orgs = NO_SOURCES, isPending: orgsPending } = useQuery(proponentsQueryOptions());

  const [panelOpen, setPanelOpen] = useState(false);

  /* Search help and the tour it starts. Both hand focus back to the link that opened them. */
  const helpLink = useRef<HTMLAnchorElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // The record decides the default sort, which the grid state needs before it can be read.
  const [searchParams] = useSearchParams();
  const config: RecordTypeConfig = recordConfig(parseGridParams(searchParams).record);

  /* Columns the record type starts with switched off. The picker still lists them, and a `cols`
     value on the URL wins over this. */
  const defaultHiddenColumns = useMemo(
    () => config.columns.filter((column) => column.defaultHidden).map((column) => column.key),
    [config],
  );

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
  } = useGridUrlState({ defaultSort: config.defaultSort, defaultHiddenColumns });

  const {
    record,
    keywords,
    scope,
    sortBy: urlSortBy,
    currentPage,
    pageSize,
    hiddenColumns,
    filters: urlFilters,
  } = state;

  /* The switch is the documents tab's, and only where the environment offers the text search. A
     `scope=inside` address in an environment that does not reads as the names scope. */
  const scopeShown = config.id === 'documents' && contentSearchEnabled();
  const inside = scopeShown && scope === 'inside';
  /* The keyword the request sends. One under the typeahead minimum is not sent, so it does not rank. */
  const searchTerm = typeaheadKeywords(keywords).trim();
  /* DEMI answers 400 for a sort its list does not take, so one the tab cannot honour reads as the
     default. Relevance is the default only while a keyword goes to a list that scores it. */
  const ranked = !inside && searchTerm !== '' && config.scored !== false;
  const fallbackSort = ranked ? RELEVANCE_SORT : config.defaultSort;
  const honoured =
    inside ||
    (urlSortBy === RELEVANCE_SORT
      ? ranked
      : sortsBy(config.columns, config.sortOptions, urlSortBy));
  const sortBy = withSortKey(config.columns, honoured ? urlSortBy : fallbackSort);

  /* The list behind the view, and the URL filters it takes. A filter it cannot answer is not
     offered or shown as a chip either; it comes back on the way to a list that takes it. */
  const wire = inside ? PASSAGE_WIRE : config.wire;
  const filters = useMemo(() => filtersFor(wire, urlFilters), [wire, urlFilters]);

  /* The field holds what is being typed; the URL holds what has been searched for. Without the
     draft every keystroke would wait on the debounce before it showed up. */
  const [draft, setDraft] = useState(keywords);

  /* The typed draft searches once it has stopped changing, on the same beat as the type counts. */
  const settledDraft = useSettled(draft, TYPEAHEAD_DEBOUNCE_MS);

  const [lastUrlKeyword, setLastUrlKeyword] = useState(keywords);
  if (keywords !== lastUrlKeyword) {
    setLastUrlKeyword(keywords);
    // A keyword this page did not write - Clear all, a chip, the back button - wins over the draft.
    if (keywords !== settledDraft.trim()) setDraft(keywords);
  }

  useEffect(() => {
    if (settledDraft.trim() !== keywords) setKeyword(settledDraft);
  }, [settledDraft, keywords, setKeyword]);

  const { counts } = useTypeCounts(draft);

  /* The columns whose filter is a year. Their value stands for a range, so it is not sent as it
     is written, and the panel's own date bounds keep precedence over it. */
  const yearFilterIds = useMemo(
    () =>
      config.columns
        .filter((column) => column.filter === 'year')
        .map((column) => column.filterId ?? column.key),
    [config],
  );

  /* A column whose filter the list cannot answer is not offered at all: not as a filter row, not
     in the panel, and not in the Filters badge. A link that carries the search gets it here. */
  const scopeColumns = useMemo(() => {
    const search: SearchContext = { keywords: searchTerm, filters, yearIds: yearFilterIds };
    return config.columns
      .filter((column) => !column.filter || takesFilter(wire, column.filterId ?? column.key))
      .map(({ searchHref, ...column }) =>
        searchHref ? { ...column, href: (row: Row) => searchHref(row, search) } : column,
      );
  }, [config, wire, searchTerm, filters, yearFilterIds]);
  /* The columns whose filter is typed. The URL splits a value on commas, so a typed name is joined
     back into one value on the wire and one chip. */
  const textFilterIds = useMemo(
    () =>
      config.columns
        .filter((column) => column.filter === 'text')
        .map((column) => column.filterId ?? column.key),
    [config],
  );
  /** The filters a column owns, which a list hands to the panel because it has no filter row. */
  const columnFilterIds = useMemo(
    () => columnFiltersForPanel(scopeColumns).map((field) => field.id),
    [scopeColumns],
  );
  const wireLabels = useMemo(() => config.wireLabels?.(orgs) ?? {}, [config, orgs]);
  const nativeFilters = useMemo(
    () => toNativeFilters(filters, yearFilterIds, wire, wireLabels, textFilterIds),
    [filters, yearFilterIds, wire, wireLabels, textFilterIds],
  );
  /* A filter sent by its label waits for the lookup that names it, rather than asking once with the
     bare id and again with the name. */
  const labelsPending = orgsPending && Object.keys(wireLabels).some((id) => filters[id] != null);

  /* Nothing to search inside until there is a word to look for: the API answers a keywordless
     chunk query with nothing, so the scope shows its prompt rather than asking. */
  const insidePrompt = inside && !searchTerm;

  const { data, isFetching, isPending, isError } = useQuery({
    queryKey: [
      'unified-search',
      record,
      scope,
      searchTerm,
      sortBy,
      currentPage,
      pageSize,
      JSON.stringify(nativeFilters),
    ],
    enabled: !insidePrompt && !labelsPending,
    queryFn: ({ signal }) =>
      runSearch(
        {
          record,
          kind: config.kind,
          inside,
          keywords: searchTerm,
          sortBy,
          currentPage,
          pageSize,
          filters: nativeFilters,
        },
        signal,
      ),
    /* Holding the last page of rows keeps the grid still while a page or a filter changes. Across
       a record type or a scope it would hand the new view the old one's rows, which its row
       component reads as its own shape: drop them and let the grid show it is loading. */
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[RECORD_IN_KEY] === record &&
      previousQuery?.queryKey[SCOPE_IN_KEY] === scope
        ? previous
        : undefined,
  });

  const rows = insidePrompt ? NO_ROWS : (data?.rows ?? NO_ROWS);

  // `optionsFrom` is a property of the config object, so the config identity is the dependency.
  const listOptions = useMemo(() => config.optionsFrom(lists, orgs), [config, lists, orgs]);
  const options = useMemo(
    () => withRowOptions(listOptions, config.optionsFromRows, rows, filters),
    [listOptions, config, rows, filters],
  );

  // The dropdown values only exist once the `List` and `Organization` reads land.
  const sortColumns: GridColumn<Row>[] = useMemo(
    () => withCells(scopeColumns, options),
    [scopeColumns, options],
  );

  const columns: GridColumn<Row>[] = useMemo(
    () => sortColumns.filter((column) => !hiddenColumns.includes(column.key)),
    [sortColumns, hiddenColumns],
  );

  const advancedFields: AdvancedField[] = useMemo(
    () =>
      config.advancedFields
        .filter((field) => takesFilter(wire, field.id))
        .map((field) =>
          field.kind === 'select'
            ? { ...field, options: options[field.id] ?? field.options }
            : field,
        ),
    [config, options, wire],
  );

  /* The narrow card has room the table never had, so it carries the attributes only the advanced
     panel can filter by. An attribute the record does not have is left off rather than shown empty. */
  function narrowExtras(row: Row): ListRowField[] {
    const pairs: ListRowField[] = [];
    for (const field of advancedFields) {
      // A panel filter on a field the card already shows as a column (notifications) is not repeated.
      if (columns.some((column) => column.key === field.id)) continue;
      const value = row[field.id];
      if (field.kind === 'toggle') {
        if (value) pairs.push({ label: field.label, value: 'Yes' });
        continue;
      }
      if (field.kind !== 'select' || value == null || value === '') continue;
      pairs.push({ label: field.label, value: optionText(options[field.id] ?? [], value) });
    }
    return pairs;
  }

  const total = data?.total ?? 0;
  /* No answer yet, so there is no total to read. Without this the bar and the empty state would
     both say the record has none of whatever was asked for, until the first answer lands. The
     prompt is not waiting on anything: no query was issued. */
  const awaitingFirstAnswer = !insidePrompt && (isPending || isFetching) && data === undefined;

  /* The switch keeps the filters in force, so the probe sends the ones the scope it points at
     would send. Without them the link offers matches the destination then filters away. */
  const otherWire = inside ? config.wire : PASSAGE_WIRE;
  const otherScopeFilters = toNativeFilters(
    filtersFor(otherWire, urlFilters),
    yearFilterIds,
    otherWire,
    {},
    textFilterIds,
  );

  /* What the other scope would find for the same word. One extra one-row search, issued only
     where this scope came back with nothing, because that is the only place it is read. */
  const { data: otherScopeTotal } = useQuery({
    queryKey: ['unified-search-other-scope', inside, searchTerm, JSON.stringify(otherScopeFilters)],
    enabled: scopeShown && !!searchTerm && !awaitingFirstAnswer && !isError && rows.length === 0,
    queryFn: ({ signal }) =>
      kindTotal(
        inside ? config.kind : 'documents/passages',
        { q: searchTerm, filters: otherScopeFilters },
        signal,
      ),
  });
  const crossScopeCount = otherScopeTotal ?? 0;

  /* The documents badge counts what the tab's own scope would find, so the number agrees with the
     list under it. Inside the documents that is this search's own total: `search/counts` measures
     names and details, and a word that appears only in the text of the files would badge the tab 0
     while eight documents are listed. Before the first answer it stays unknown rather than 0. */
  const insideTotal = inside && !insidePrompt && data !== undefined ? total : null;

  /* A date column offers every year the record spans, plus whichever year is filtered on, so the
     choice in force never drops out of its own list. */
  const gridColumns: GridColumn<Row>[] = useMemo(
    () =>
      columns.map((column) => {
        if (column.filter !== 'year') return column;
        const id = column.filterId ?? column.key;
        return { ...column, options: yearOptions(asFilterText(filters[id])) };
      }),
    [columns, filters],
  );

  /* A passage row stands for one document, so it ticks like one: same bulk-download gate as the
     names scope, and the id that goes into the basket is the document's. */
  const selectable = config.selectable;
  const template = inside ? 'list' : config.template;
  /** What the column picker offers. A list row draws itself, so it has no column to hide. */
  const pickableColumns = template === 'list' ? undefined : config.columns;
  const selection = useSelection(TABLE_ID);
  const downloadInProgress = useDownloadInProgress();
  const selectedIds = useMemo(() => [...selection.keys()], [selection]);

  function rowId(row: Row): string {
    // A chunk row is a document's passages, and `documentId` is the file the download asks for.
    return String(row['documentId'] ?? row['id'] ?? '');
  }

  function rowLabel(row: Row): string {
    return String(row['displayName'] ?? row['name'] ?? rowId(row));
  }

  function toggleRow(row: Row): void {
    const accepted = toggleSelected(TABLE_ID, {
      id: rowId(row),
      displayName: rowLabel(row),
      size: toSize(row['fileSize']),
    });
    if (!accepted) showToast(CAP_MESSAGE, { type: 'warning' });
  }

  /** The passage list hands back the document id it drew; the row it came from carries the rest. */
  function toggleById(id: string): void {
    const row = rows.find((candidate) => rowId(candidate) === id);
    if (row) toggleRow(row);
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
        size: toSize(row['fileSize']),
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
    const column = config.columns.find((item) => (item.filterId ?? item.key) === id);
    if (column) return column.label;
    return advancedFields.find((field) => field.id === id)?.label ?? id;
  }

  const chips: GridChip[] = [];
  if (keywords) chips.push({ id: 'keywords', label: 'Search', value: keywords });
  for (const [id, value] of Object.entries(filters)) {
    const label = labelOfFilter(id);
    if (textFilterIds.includes(id)) {
      const typed = typedText(value);
      if (typed !== '') chips.push({ id, label, value: typed });
      continue;
    }
    const picks = Array.isArray(value) ? value : [value];
    for (const pick of picks) {
      chips.push({ id, label, value: labelOfValue(options[id] ?? [], pick), raw: pick });
    }
  }

  function removeChip(id: string, raw?: string): void {
    if (id === 'keywords') {
      setDraft('');
      setKeyword('');
      return;
    }
    // A typed name is one chip, however many commas the URL split it on.
    if (textFilterIds.includes(id)) {
      setFilter(id, null);
      return;
    }
    const current = filters[id];
    if (raw !== undefined && Array.isArray(current)) {
      const next = current.filter((pick) => pick !== raw);
      setFilter(id, next.length > 0 ? next : null);
      return;
    }
    setFilter(id, null);
  }

  function clearEverything(): void {
    setDraft('');
    clearSelection(TABLE_ID);
    clearAll();
  }

  /* What the Filters button counts. A list has no filter row, so its column filters live in the
     panel too and belong in its badge. */
  const panelIds =
    template === 'list'
      ? [...advancedFields.map((field) => field.id), ...columnFilterIds]
      : advancedFields.map((field) => field.id);
  const advancedCount = panelIds.filter((id) => filters[id] != null).length;
  const filterCount = Object.keys(filters).length;
  const noun = config.noun ?? config.label.toLowerCase();

  /** "See 4 matches inside the documents", which is the way out of a scope that found none. */
  function crossScopeLink(): ReactNode {
    if (crossScopeCount < 1) return null;
    const matches =
      crossScopeCount === 1 ? '1 match' : `${crossScopeCount.toLocaleString('en-CA')} matches`;
    return (
      <button
        type="button"
        className="unified-search__empty-cross"
        onClick={() => setScope(inside ? 'names' : 'inside')}
      >
        {`See ${matches} ${inside ? 'in names & details' : 'inside the documents'}`}
      </button>
    );
  }

  function emptyState(): ReactNode {
    // The prompt stands in for the empty state: nothing was asked, so nothing is missing.
    if (insidePrompt) return null;
    if (awaitingFirstAnswer) return null;
    if (isError) {
      return (
        <span className="unified-search__empty">
          <span className="unified-search__empty-title">Search is unavailable right now</span>
          <span className="unified-search__empty-detail">Try again in a moment.</span>
        </span>
      );
    }
    const title = searchTerm
      ? `Nothing in ${noun} matches “${searchTerm}”`
      : filterCount > 0
        ? `No ${noun} match these filters`
        : `No ${noun} found`;
    /* The two scopes point at each other: whichever one is empty, the app already knows whether
       the other has matches for the same word, so it says so rather than dead-ending. */
    const detail =
      crossScopeCount > 0
        ? inside
          ? 'No passage inside a document contains it, but the name or details of one do.'
          : 'No name or detail matches it, but the text inside the documents does.'
        : searchTerm
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
        {crossScopeLink()}
        {(searchTerm || filterCount > 0) && (
          <button type="button" className="unified-search__empty-action" onClick={clearEverything}>
            Clear filters and search
          </button>
        )}
      </span>
    );
  }

  const passageRows = inside ? rows.map(toPassageRow) : [];

  /* Inside the documents the records are passages within a file, which no row of cells holds, so
     the page draws the body and the grid keeps the bar, the chips, the panel and the pager. */
  const insideBody: ReactNode = !inside ? undefined : insidePrompt ? (
    <div className="unified-search__prompt">
      <p className="unified-search__prompt-title">Search inside the documents</p>
      <p className="unified-search__prompt-detail">
        Type a word or phrase to find it in the text of the documents, not just their names. Results
        show the matching passage from each document.
      </p>
    </div>
  ) : (
    <PassageList
      rows={passageRows}
      terms={toTerms(searchTerm)}
      loading={isFetching}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggle={toggleById}
    />
  );

  const scopeControl = scopeShown ? (
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
      <PageMasthead title="Search" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Search' }]}>
        <div className="unified-search__query">
          <div className="unified-search__field" data-tour="search">
            <i className="material-icons unified-search__field-icon" aria-hidden="true">
              search
            </i>
            <label className="unified-search__field-label">
              <span className="unified-search__visually-hidden">{SEARCH_LABEL}</span>
              <input
                type="search"
                className="unified-search__input"
                placeholder={SEARCH_PLACEHOLDER}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
          </div>

          {/* The long-form page is still the destination for a new tab or a reader with no
            JavaScript; a plain press gets the summary in a dialog without leaving the results. */}
          <Link
            ref={helpLink}
            className="unified-search__help"
            to="/search-help"
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              setHelpOpen(true);
            }}
          >
            <i className="material-icons unified-search__help-icon" aria-hidden="true">
              help_outline
            </i>
            <span className="link-label">Search help</span>
          </Link>
        </div>

        <div
          className="unified-search__types"
          data-tour="types"
          role="group"
          aria-label="Record type"
        >
          {RECORD_TYPES.map((id) => {
            const on = id === record;
            const count = id === 'documents' && insideTotal !== null ? insideTotal : counts?.[id];
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
      </PageMasthead>

      <div className="unified-search__body page-container">
        <SearchHelpDialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          onStartTour={() => {
            setHelpOpen(false);
            setTourOpen(true);
          }}
          restoreFocusTo={helpLink}
        />
        <GuidedTour open={tourOpen} onEnd={() => setTourOpen(false)} restoreFocusTo={helpLink} />

        {/* The site-wide sign-up the News page used to carry. Updates are what the subscription
          sends, so it rides that tab only; the guard keeps the band's spacing out of the page
          when NOTIFY_API is unset. */}
        {record === 'activities' && !!getNotifyApi() && (
          <div className="unified-search__subscribe">
            <SubscribePopover serviceName="eao:updates" variant="all" />
          </div>
        )}

        <DisplayGrid<Row>
          caption={`${recordLabel(record)} matching this search`}
          columns={gridColumns}
          rows={rows}
          template={template}
          rowComponent={config.rowComponent}
          body={insideBody}
          sortOptions={inside ? INSIDE_SORT_OPTIONS : config.sortOptions}
          sortColumns={sortColumns}
          ranked={ranked}
          footer={!insidePrompt}
          loading={isFetching && !insidePrompt}
          emptyMessage={emptyState()}
          selectable={selectable}
          sort={headerSort(config.columns, sortBy)}
          filters={filters}
          onSort={(key, dir) => {
            const field = sortKeyOf(config.columns, key);
            // The address may hold the column key, which the toggle in `setSort` does not match.
            setSort(field, dir ?? (sortBy === `+${field}` ? '-' : '+'));
          }}
          narrowExtras={narrowExtras}
          onFilterChange={(id, value) => setFilter(id, value)}
          page={currentPage}
          pageSize={pageSize}
          // DEMI pages an anonymous reader only this deep, so the pager stops there.
          total={reachableTotal(total, pageSize)}
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
              loading={awaitingFirstAnswer}
              /* A keyword or a filter is in force, so the count is of what matched rather than of
               everything the record type holds: "1–8 of 8 documents matching". */
              narrowed={!!searchTerm || filterCount > 0}
              /* The prompt has asked the index nothing, so the bar states what is searchable. An
               unknown documents total says nothing rather than claiming a number. */
              countText={
                insidePrompt && typeof counts?.documents === 'number'
                  ? `${counts.documents.toLocaleString('en-CA')} documents indexed`
                  : undefined
              }
              scope={scopeControl}
              columns={pickableColumns}
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
              /* The record's own fields first, then whichever column filters the layout has no row
               for. The grid decides that: with columns on screen it hands back none. */
              fields={[...advancedFields, ...columnFilters]}
              values={filters}
              onChange={(id, value) => setFilter(id, value)}
              open={panelOpen}
            />
          )}
        />
      </div>
    </div>
  );
}
