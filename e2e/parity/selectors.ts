/**
 * One control, two selectors: how the design prototype exposes it, and how the built page does.
 *
 * The parity gate drives the same step list against both, so this is the only file that has to
 * change when either side renames something. `proto` values are verified against
 * `design/handoffs/unified-search/Display Grid - Rebuild.dc.html`.
 *
 * `app` values are the contract the unified /search page is expected to meet. The grid components
 * exist on this branch, so every entry that names a control the grid itself renders has been
 * checked against the real class name or `data-tour` hook and is verified.
 *
 * Still unverified, because the page around the grid is Phase 2 work: the search box
 * (`data-tour="search"`), the record-type tabs (`"types"`), the scope switch (`"scope"`), the
 * search-help link and dialog, and the guided tour. Phase 2 has to put those hooks on the page for
 * these entries to resolve. The parity spec skips itself until `.display-grid` is on the page, so
 * the first Phase 2 run is what confirms them.
 */
export type ControlKey =
  | 'root'
  | 'searchInput'
  | 'tabProjects'
  | 'tabDocuments'
  | 'tabActivities'
  | 'scopeNames'
  | 'scopeInside'
  | 'moreFilters'
  | 'columnsPicker'
  | 'filterPickDocumentType'
  | 'searchHelpLink'
  | 'helpDialog'
  | 'startTour'
  | 'tourCard'
  | 'tourRing'
  | 'tourNext'
  | 'copyLink'
  | 'toolbar'
  | 'resultsTable'
  | 'sortedHeader'
  | 'chipRow'
  | 'highlightMark'
  | 'rowSelect1'
  | 'rowSelect2'
  | 'emptyState';

export interface ControlSelector {
  proto: string;
  app: string;
}

export const SELECTORS: Record<ControlKey, ControlSelector> = {
  root: { proto: '.grid-root', app: '.display-grid' },
  searchInput: {
    proto: '[data-tour="search"] input[type="search"]',
    app: '[data-tour="search"] input[type="search"]',
  },
  tabProjects: {
    proto: '[data-tour="types"] button:has-text("Projects")',
    app: '[data-tour="types"] button:has-text("Projects")',
  },
  tabDocuments: {
    proto: '[data-tour="types"] button:has-text("Documents")',
    app: '[data-tour="types"] button:has-text("Documents")',
  },
  tabActivities: {
    proto: '[data-tour="types"] button:has-text("Activities & updates")',
    app: '[data-tour="types"] button:has-text("Activities & updates")',
  },
  scopeNames: {
    proto: '[data-tour="scope"] button:has-text("Names & details")',
    app: '[data-tour="scope"] button:has-text("Names & details")',
  },
  scopeInside: {
    proto: '[data-tour="scope"] button:has-text("Inside documents")',
    app: '[data-tour="scope"] button:has-text("Inside documents")',
  },
  moreFilters: { proto: '[data-tour="more"]', app: '[data-tour="more"]' },
  columnsPicker: { proto: '[data-tour="columns"]', app: '[data-tour="columns"]' },
  filterPickDocumentType: {
    proto: '[data-tour="filterrow"] button[aria-label="Filter by Document type"]',
    app: '[data-tour="filterrow"] button[aria-label="Filter by Document type"]',
  },
  searchHelpLink: {
    proto: 'a:has-text("Search help")',
    app: 'a:has-text("Search help")',
  },
  helpDialog: {
    proto: '[data-help="1"] [role="dialog"]',
    app: '[data-help="1"] [role="dialog"]',
  },
  startTour: {
    proto: '[data-help="1"] [role="dialog"] button:has-text("tour")',
    app: '[data-help="1"] [role="dialog"] button:has-text("tour")',
  },
  tourCard: {
    proto: '[role="dialog"][aria-modal="true"]:not([aria-labelledby])',
    app: '[role="dialog"][aria-modal="true"]:not([aria-labelledby])',
  },
  // The ring the tour draws round the control the current step describes.
  tourRing: {
    proto: 'div[aria-hidden="true"][style*="--theme-gold-90"]',
    app: 'div[aria-hidden="true"][style*="--theme-gold-90"]',
  },
  tourNext: {
    proto: '[role="dialog"][aria-modal="true"] button:has-text("Next")',
    app: '[role="dialog"][aria-modal="true"] button:has-text("Next")',
  },
  copyLink: { proto: '[data-tour="copy"]', app: '[data-tour="copy"]' },
  toolbar: {
    proto: 'section > div:first-child',
    app: '.display-grid__bar',
  },
  resultsTable: { proto: 'table', app: '.display-grid__table' },
  // The 2px sorted marker is an inset box-shadow on the th, not a border.
  sortedHeader: {
    proto: 'thead th[aria-sort]',
    app: '.display-grid thead th[aria-sort]',
  },
  // The band that lists the applied filters, identified by the label it always carries.
  chipRow: {
    proto: 'div:has(> span:text-is("Narrowed by"))',
    app: '.display-grid__chips',
  },
  // The prototype highlights a keyword hit with an inline-styled span. Both sides are asserted to
  // resolve to the same --theme-gold-40 ground, whatever element carries it.
  highlightMark: {
    proto: 'span[style*="--theme-gold-40"]',
    app: '.display-grid__hit',
  },
  rowSelect1: {
    proto: 'tbody tr:nth-child(1) input[type="checkbox"]',
    app: '.display-grid tbody tr:nth-child(1) input[type="checkbox"]',
  },
  rowSelect2: {
    proto: 'tbody tr:nth-child(2) input[type="checkbox"]',
    app: '.display-grid tbody tr:nth-child(2) input[type="checkbox"]',
  },
  emptyState: {
    proto: 'text=/No (documents|results)/',
    app: '.display-grid__empty',
  },
};

export type Side = 'proto' | 'app';

export function selectorFor(key: ControlKey, side: Side): string {
  return SELECTORS[key][side];
}
