import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { DatePickerComponent } from 'app/shared/components/date-picker/date-picker.component';
import {
  type FacetDef,
  type DateFacetDef,
  type DisplayItem,
  type LegislationGroup,
  type SortOption,
} from '../search-collections';

/** Payload emitted when the user toggles a refinement checkbox */
export interface RefineFacetEvent {
  attribute: string;
  value: string;
}

/**
 * SearchFilterSidebarComponent — shared filter sidebar for all Typesense search surfaces.
 *
 * Receives all data as inputs (pure presentational after binding) and emits
 * events upward.  The parent component owns sidebar-collapse state, collapsed-
 * facets set, and the engine instance.
 *
 * Supports:
 *  - Regular (flat) facets
 *  - Grouped (legislation-year) facets via `groupedSnapshot`
 *  - Optional date range picker
 *  - Optional sort options (activities tab)
 *  - Desktop accordion per-facet + mobile filter toggle
 */
@Component({
  selector: 'app-search-filter-sidebar',
  templateUrl: './search-filter-sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePickerComponent],
  styles: [':host { display: contents; }'],
})
export class SearchFilterSidebarComponent {

  // ── Facets ──────────────────────────────────────────────────────────────────
  readonly facets        = input.required<readonly FacetDef[]>();
  readonly facetSnapshot = input.required<Record<string, DisplayItem[]>>();
  readonly groupedSnapshot = input<Record<string, LegislationGroup[]>>({});

  // ── Sidebar / filter state ──────────────────────────────────────────────────
  readonly filtersLoaded    = input.required<boolean>();
  readonly sidebarCollapsed = input.required<boolean>();
  readonly filtersOpen      = input(false);
  readonly collapsedFacets  = input<Set<string>>(new Set());

  // ── Date filter ─────────────────────────────────────────────────────────────
  readonly dateFacet     = input<DateFacetDef | undefined>(undefined);
  readonly fromCtrl      = input<FormControl<string | null> | null>(null);
  readonly toCtrl        = input<FormControl<string | null> | null>(null);
  readonly hasDateFilter = input(false);

  // ── Sort (activities tab only) ───────────────────────────────────────────────
  readonly sortOptions = input<readonly SortOption[] | undefined>(undefined);
  readonly activeSortBy = input('');

  // ── Meta ────────────────────────────────────────────────────────────────────
  readonly sidebarId   = input('searchFilterSidebar');
  readonly ariaLabel   = input('Search filters');
  readonly activeFilterCount = input(0);

  /** Availability guard — hides the loading spinner when Typesense is down */
  readonly typesenseAvailable = input(true);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly toggleSidebar      = output<void>();
  readonly toggleFiltersOpen  = output<void>();
  readonly toggleFacet        = output<string>();
  readonly refineFacet        = output<RefineFacetEvent>();
  readonly clearDateFilter    = output<void>();
  readonly sortChanged        = output<string>();

  // ── Helpers ─────────────────────────────────────────────────────────────────
  readonly minDate = new Date(1970, 0, 1);

  isFacetCollapsed(attribute: string): boolean {
    return this.collapsedFacets().has(attribute);
  }
}
