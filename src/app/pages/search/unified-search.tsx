import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { track } from 'app/analytics/analytics';
import { listsQueryOptions } from 'app/api/api';
import { proponentsQueryOptions } from 'app/api/org';
import { fetchData, getSearchResults, SearchParamObject } from 'app/api/search';
import { AdvancedFilters } from 'app/components/display-grid/advanced-filters';
import { ChipRow, type GridChip } from 'app/components/display-grid/chip-row';
import { DisplayGrid, type SortOption } from 'app/components/display-grid/display-grid';
import { columnFiltersForPanel, sortStateOf } from 'app/components/display-grid/grid-helpers';
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
  useGridUrlState,
  type RecordType,
  type SearchScope,
} from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { contentSearchEnabled, getNotifyApi } from 'app/config/config';
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
import { toWireFilters, yearOptions } from './search-filters';
import { recordConfig, type RecordTypeConfig, type SearchMeta } from './types';
import { ATTACHMENTS_FILTER_ID, attachmentsFilterDropped } from './types/activities';
import { PROJECTS_FALLBACK_SORT, PROJECTS_SORT, resolveSort } from './types/projects';
import { useSettled } from './use-settled';
import { useTypeCounts } from './use-type-counts';
import './unified-search.css';

type Row = Record<string, unknown>;

/** Selection bucket name. The unified page is what `/search` selects documents from. */
const TABLE_ID = 'search';

/** Where the record type and scope sit in the search query key; the placeholder reads them back. */
const RECORD_IN_KEY = 1;
const SCOPE_IN_KEY = 2;

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'names', label: 'Names & details' },
  { value: 'inside', label: 'Inside documents' },
];

/** The text inside the files: one row per document, carrying the passages that matched. */
const INSIDE_DATASET = 'DocumentChunk';

/**
 * demi-search reads `-score` as "issue no $orderby", which leaves the relevance ranking in place.
 * Every field of the chunk index is `sortable: false`, so this is the only order the scope has,
 * and the URL spells it `-matches` because that is what the reader is choosing.
 */
const INSIDE_WIRE_SORT = '-score';
const INSIDE_SORT_OPTIONS: SortOption[] = [{ value: INSIDE_SORT, label: 'Most matches' }];

/** A half-typed last word is a name affordance; the API leaves prefix matching off for passages. */
const NO_PREFIX = [{ name: 'prefix', value: 'false' }];

/** demi-search answers 400 for `and[nameContains]` on the chunk dataset: it filters names only. */
const NAMES_ONLY_FILTERS = ['nameContains'];

/** Whether a scope can narrow by a filter id. The one place that rule is read. */
function scopeTakes(inside: boolean, id: string): boolean {
  return !inside || !NAMES_ONLY_FILTERS.includes(id);
}

/** The filters a scope can answer; the rest come back on the way out of it. */
function filtersForScope(inside: boolean, values: FilterValues): FilterValues {
  return Object.fromEntries(Object.entries(values).filter(([id]) => scopeTakes(inside, id)));
}

/** The API wraps each hit in `<mark>`; the passage list marks the terms itself, from plain text. */
const MARK_TAG = /<\/?mark>/g;

/**
 * The page a passage sits on, read off a row or off one entry of its `passages` array. Only a
 * document extracted with page markers carries one, and a flagged page can still fail to arrive.
 */
function pageOf(source: unknown): number | null {
  const fields = (source ?? {}) as Record<string, unknown>;
  if (fields['pageNumbered'] !== true) return null;
  const page = Number(fields['pageNumber']);
  return Number.isInteger(page) && page > 0 ? page : null;
}

/** A passage as the list shows it: named by its page where it has one, otherwise by its place. */
function toHit(text: unknown, index: number, page: number | null): PassageHit {
  const hit: PassageHit = {
    locator: index + 1,
    text: String(text ?? '')
      .replace(MARK_TAG, '')
      .trim(),
  };
  if (page !== null) {
    hit.locator = page;
    hit.pageNumbered = true;
  }
  return hit;
}

/**
 * A grouped chunk row as the passage list reads one. The API returns one row per document with the
 * passages that matched inside it, ordered by relevance, and `matchCount` is how many this page
 * found.
 */
function toPassageRow(row: Row): PassageRow {
  /* The document the passages came from, which is what the file link opens and what a selection
     hands the bulk download. The grouped row repeats it as `_id`; the chunk's own id names no file. */
  const id = String(row['documentId'] ?? row['_id'] ?? '');
  const name = String(row['documentName'] ?? '') || 'Untitled document';
  const href = documentDownloadUrl({ _id: id, displayName: name });
  const snippets = Array.isArray(row['snippets']) ? (row['snippets'] as unknown[]) : [];
  const entries = Array.isArray(row['passages']) ? (row['passages'] as unknown[]) : [];
  const date = row['datePosted'];
  const type = row['documentType'];
  /* A passage is labelled by its place in the results, except one the index gave a page: that one
     names the page and links into the file at it. `passages` carries a page per passage; a build
     without it only says where the row's first passage sits. */
  const hits = entries.length
    ? entries.map((entry, index) => toHit((entry as Row | null)?.['text'], index, pageOf(entry)))
    : snippets.map((text, index) => toHit(text, index, index === 0 ? pageOf(row) : null));
  return {
    id,
    name,
    href: isSafeUrl(href) ? href : '',
    date: date ? String(date) : null,
    type: type ? String(type) : null,
    // A chunk row carries no author: the four parent facets stamped on it are filter ids.
    author: null,
    passages: hits,
    total: Number(row['matchCount']) || hits.length,
  };
}

/** The other scope's total for the same keyword and filters, read one row at a time. */
async function scopeTotal(
  dataset: string,
  keywords: string,
  filters: Record<string, string>,
  signal?: AbortSignal,
): Promise<number | null> {
  const chunks = dataset === INSIDE_DATASET;
  const results = await fetchData(
    new SearchParamObject(
      `search-scope-${dataset}`,
      keywords,
      dataset,
      chunks ? NO_PREFIX : [],
      1,
      1,
      chunks ? INSIDE_WIRE_SORT : '',
      {},
      false,
      '',
      filters,
    ),
    signal,
  );
  return results?.totalSearchCount ?? null;
}

function recordLabel(record: RecordType): string {
  return recordConfig(record).label;
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
  /** Extra query params, as `searchKeywords` appends them: `{name, value}` pairs. */
  fields?: { name: string; value: string }[];
}

/**
 * One page of results plus the envelope's `meta`, which `fetchData` drops and the projects tab
 * needs to learn whether its sort field survived the index.
 */
async function runSearch(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage> {
  const results = await getSearchResults(
    request.keywords,
    request.dataset,
    request.fields ?? [],
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

  // A failed read answers null, which otherwise reads downstream as a search that matched nothing.
  if (!results) throw new Error('Search request failed');

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

/** A Mongo id, which is a database key and never a word the reader asked to see. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/**
 * A stored value as the cell's words: the option's label, or the value itself when it is plain
 * text the index stored directly. An id the List collection has no row for reads as nothing,
 * because a bare `6a61123ff0c29b9e36505fd7` in an Author cell tells the reader less than a blank.
 */
function cellLabel(options: ValueOption[], value: string): string {
  const label = options.find((option) => option.value === value)?.label;
  if (label !== undefined) return label;
  return OBJECT_ID.test(value) ? '' : value;
}

/** One stored pick as its name. Populated rows carry the whole record, bare ones carry the id. */
function pickText(options: ValueOption[], pick: unknown): string {
  if (pick && typeof pick === 'object') {
    const held = pick as Record<string, unknown>;
    return String(held['name'] ?? cellLabel(options, String(held['_id'] ?? '')));
  }
  return cellLabel(options, String(pick ?? ''));
}

/** A cell's stored value as the reader's words. A multi-value cell reads as a list. */
function optionText(options: ValueOption[], value: unknown): string {
  const picks = Array.isArray(value) ? value : [value];
  return picks
    .map((pick) => pickText(options, pick))
    .filter(Boolean)
    .join(', ');
}

/**
 * A date in the grid is YYYY-MM-DD, so the digits line up column to column and a row reads as a
 * row. Read in UTC: the stored date is the day the record carries, not a local instant.
 */
function gridDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/** A coded value reads as its name, a date as a date; anything else is the stored text. */
/** A filter value as one string; a multi-select holds a list, a year holds one. */
function asFilterText(value: FilterValues[string] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function cellRenderer(
  column: GridColumn<Row>,
  picks: ValueOption[] | undefined,
): ((row: Row) => string) | undefined {
  // A date is read, never looked up: the year options a date column offers are not its cell values.
  if (column.date) return (row) => gridDate(row[column.key]);
  if (picks) return (row) => optionText(picks, row[column.key]);
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

  /* Search help and the tour it starts. Both hand focus back to the link that opened them. */
  const helpLink = useRef<HTMLAnchorElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  /* The activities tab offers "Documents attached" until a response says the index carries no
     `documentUrl`, which it can only say once a query has named the field. */
  const [attachmentsDropped, setAttachmentsDropped] = useState(false);

  // The record decides the default sort, which the grid state needs before it can be read.
  const [searchParams] = useSearchParams();
  const config: RecordTypeConfig = recordConfig(parseGridParams(searchParams).record);
  const defaultSort = config.id === 'projects' ? projectsSort : config.defaultSort;

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

  const {
    record,
    keywords,
    scope,
    sortBy,
    currentPage,
    pageSize,
    hiddenColumns,
    filters: urlFilters,
  } = state;

  /* The switch is the documents tab's, and only where the environment offers the text search. A
     `scope=inside` address in an environment that does not reads as the names scope. */
  const scopeShown = config.id === 'documents' && contentSearchEnabled();
  const inside = scopeShown && scope === 'inside';

  /* A filter the chunk dataset cannot answer is not applied inside the documents, so it is not
     offered or shown as a chip there either. It comes back on the way out of the scope. */
  const filters = useMemo(() => filtersForScope(inside, urlFilters), [inside, urlFilters]);

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

  const options = useMemo(
    () => config.optionsFrom(lists, orgs),
    // `optionsFrom` is a property of the config object, so the config identity is the dependency.
    [config, lists, orgs],
  );

  /* A column whose filter the scope cannot answer is not offered there at all: not as a filter
     row, not in the panel, and not in the Filters badge. */
  const scopeColumns = useMemo(
    () => config.columns.filter((column) => scopeTakes(inside, column.filterId ?? column.key)),
    [config, inside],
  );

  /* Every column of every record type is sortable in the index, and the dropdown values only
     exist once the `List` and `Organization` reads land. */
  const columns: GridColumn<Row>[] = useMemo(
    () =>
      scopeColumns
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
    [scopeColumns, hiddenColumns, options],
  );

  const advancedFields: AdvancedField[] = useMemo(
    () =>
      config.advancedFields
        // A filter the index cannot honour is taken off the panel rather than left there to
        // narrow nothing.
        .filter((field) => !(attachmentsDropped && field.id === ATTACHMENTS_FILTER_ID))
        .map((field) =>
          field.kind === 'select'
            ? { ...field, options: options[field.id] ?? field.options }
            : field,
        ),
    [attachmentsDropped, config, options],
  );

  /* The narrow card has room the table never had, so it carries the attributes only the advanced
     panel can filter by. An attribute the record does not have is left off rather than shown empty. */
  function narrowExtras(row: Row): ListRowField[] {
    const pairs: ListRowField[] = [];
    for (const field of advancedFields) {
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

  const searchTerm = typeaheadKeywords(keywords).trim();
  /* The columns whose filter is a year. Their value stands for a range, so it is not sent as it
     is written, and the panel's own date bounds keep precedence over it. */
  const yearFilterIds = useMemo(
    () =>
      config.columns
        .filter((column) => column.filter === 'year')
        .map((column) => column.filterId ?? column.key),
    [config],
  );
  /* The columns whose filter is typed. Their value is one string, not a list of picks, so it is
     trimmed before it is sent and stays one chip however many commas it carries. */
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
  const wireFilters = useMemo(
    () => toWireFilters(filters, yearFilterIds, textFilterIds),
    [filters, yearFilterIds, textFilterIds],
  );

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
      JSON.stringify(wireFilters),
    ],
    enabled: !insidePrompt,
    queryFn: ({ signal }) =>
      runSearch(
        {
          keywords: searchTerm,
          dataset: inside ? INSIDE_DATASET : config.dataset,
          sortBy: inside ? INSIDE_WIRE_SORT : sortBy,
          currentPage,
          pageSize,
          filters: wireFilters,
          record,
          fields: inside ? NO_PREFIX : [],
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

  /* Same one-way rule as the projects sort: the answer only names `documentUrl` while the query
     does, so moving back would re-ask with the field the index just refused. */
  if (record === 'activities' && !attachmentsDropped && attachmentsFilterDropped(data?.meta)) {
    setAttachmentsDropped(true);
  }

  useEffect(() => {
    // The control is gone, so its chip and its URL value would have no way back off the page.
    if (attachmentsDropped && filters[ATTACHMENTS_FILTER_ID] != null) {
      setFilter(ATTACHMENTS_FILTER_ID, null);
    }
  }, [attachmentsDropped, filters, setFilter]);

  const rows = insidePrompt ? [] : (data?.rows ?? []);
  const total = data?.total ?? 0;
  /* No answer yet, so there is no total to read. Without this the bar and the empty state would
     both say the record has none of whatever was asked for, until the first answer lands. The
     prompt is not waiting on anything: no query was issued. */
  const awaitingFirstAnswer = !insidePrompt && (isPending || isFetching) && data === undefined;

  /* The switch keeps the filters in force, so the probe sends the ones the scope it points at
     would send. Without them the link offers matches the destination then filters away. */
  const otherScopeFilters = useMemo(
    () => toWireFilters(filtersForScope(!inside, urlFilters), yearFilterIds, textFilterIds),
    [inside, urlFilters, yearFilterIds, textFilterIds],
  );

  /* What the other scope would find for the same word. One extra one-row search, issued only
     where this scope came back with nothing, because that is the only place it is read. */
  const { data: otherScopeTotal } = useQuery({
    queryKey: ['unified-search-other-scope', inside, searchTerm, JSON.stringify(otherScopeFilters)],
    enabled: scopeShown && !!searchTerm && !awaitingFirstAnswer && !isError && rows.length === 0,
    queryFn: ({ signal }) =>
      scopeTotal(inside ? config.dataset : INSIDE_DATASET, searchTerm, otherScopeFilters, signal),
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
    return String(row['documentId'] ?? row['_id'] ?? '');
  }

  function rowLabel(row: Row): string {
    return String(row['displayName'] ?? row['documentName'] ?? row['name'] ?? rowId(row));
  }

  function toggleRow(row: Row): void {
    const accepted = toggleSelected(TABLE_ID, {
      id: rowId(row),
      displayName: rowLabel(row),
      size: toSize(row['internalSize']),
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
    const column = config.columns.find((item) => (item.filterId ?? item.key) === id);
    if (column) return column.label;
    return advancedFields.find((field) => field.id === id)?.label ?? id;
  }

  const chips: GridChip[] = [];
  if (keywords) chips.push({ id: 'keywords', label: 'Search', value: keywords });
  for (const [id, value] of Object.entries(filters)) {
    const label = labelOfFilter(id);
    /* Typed text is one narrowing however it is punctuated: the URL splits a value on commas, so
       a name carrying one would otherwise read as two chips that each drop half of it. */
    if (textFilterIds.includes(id)) {
      const typed = (Array.isArray(value) ? value.join(',') : value).trim();
      if (typed !== '') chips.push({ id, label, value: typed });
      continue;
    }
    const picks = Array.isArray(value) ? value : [value];
    for (const pick of picks) {
      chips.push({ id, label, value: labelOfValue(options[id] ?? [], pick) });
    }
  }

  function removeChip(id: string, value?: string): void {
    if (id === 'keywords') {
      setDraft('');
      setKeyword('');
      return;
    }
    if (textFilterIds.includes(id)) {
      setFilter(id, null);
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

  const passageRows = useMemo(() => (inside ? rows.map(toPassageRow) : []), [inside, rows]);

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
      <nav aria-label="Breadcrumb" className="unified-search__breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Search</li>
        </ol>
      </nav>

      <h1 className="unified-search__title">Search</h1>

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
            onChange={(event) => setDraft(event.target.value)}
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
          Search help
        </Link>
      </div>

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
        sortOptions={inside ? INSIDE_SORT_OPTIONS : undefined}
        footer={!insidePrompt}
        headerless={config.headerless}
        loading={isFetching && !insidePrompt}
        emptyMessage={emptyState()}
        selectable={selectable}
        sort={sortStateOf(sortBy)}
        filters={filters}
        onSort={(key, dir) => setSort(key, dir ?? '+')}
        narrowExtras={narrowExtras}
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
  );
}
