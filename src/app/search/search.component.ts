import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TableListComponent } from 'app/shared/components/table-list/table-list.component';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { createSearchConfig } from './search.config';
import { createContentSearchConfig } from './content-search.config';

/**
 * Both search tabs. `/search` lists documents by their metadata; `/search/content` searches the
 * text inside them.
 *
 * Two routes rather than a query parameter, so each tab is linkable and the router builds a fresh
 * component per tab — `TableListComponent` reads its config once in `ngOnInit`, so swapping the
 * config on a reused instance would leave the previous dataset's table in place.
 */
@Component({
  selector: 'app-search',
  template: '<app-table-list [config]="config" />',
  styleUrls: ['./search.component.css'],
  imports: [TableListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class SearchComponent {
  private route = inject(ActivatedRoute);

  readonly config: TableListConfig = this.route.snapshot.data['content']
    ? createContentSearchConfig()
    : createSearchConfig();
}
