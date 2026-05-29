import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import type { CollectionId } from '../search-collections';
import { SearchProjectCardComponent } from '../cards/search-project-card.component';
import { SearchDocumentCardComponent } from '../cards/search-document-card.component';
import { SearchActivityCardComponent } from '../cards/search-activity-card.component';
import { SearchNotificationCardComponent } from '../cards/search-notification-card.component';

/**
 * SearchResultsListComponent — shared card list for all Typesense search surfaces.
 *
 * Renders the appropriate card component per collectionId and handles skeleton
 * loading, error, and empty states.  Emits events upward for analytics.
 *
 * Infinite-scroll sentinel is rendered at the bottom of the list; the parent
 * wires the sentinel element to TypesenseSearchEngine.setupObserver().
 */
@Component({
  selector: 'app-search-results-list',
  templateUrl: './search-results-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SearchProjectCardComponent,
    SearchDocumentCardComponent,
    SearchActivityCardComponent,
    SearchNotificationCardComponent,
  ],
  styles: [':host { display: block; }'],
})
export class SearchResultsListComponent {

  // ── Data inputs ─────────────────────────────────────────────────────────────
  readonly hits          = input.required<any[]>();
  readonly collectionId  = input.required<CollectionId>();

  // ── State inputs ─────────────────────────────────────────────────────────────
  readonly isLoading     = input.required<boolean>();
  readonly isLoadingMore = input(false);
  readonly hasSearched   = input.required<boolean>();
  readonly hasError      = input(false);
  readonly emptyMessage  = input('No results found.');

  // ── Display options ──────────────────────────────────────────────────────────
  /** When false, document cards omit the "View Project Page" link. */
  readonly showProjectLink = input(true);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  /** Fired when a project / activity / notification card is clicked. */
  readonly resultClicked   = output<{ hit: any; index: number }>();
  /** Fired when a document card download button is clicked. */
  readonly downloadClicked = output<any>();
  /** Fired when the project link on a card is clicked. */
  readonly projectClicked  = output<{ hit: any; index: number }>();
}
