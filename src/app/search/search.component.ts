import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TableListComponent } from 'app/shared/components/table-list/table-list.component';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { createSearchConfig } from './search.config';

/** Document metadata search. The content tab is `ContentSearchComponent`, which renders a list. */
@Component({
  selector: 'app-search',
  template: '<app-table-list [config]="config" />',
  styleUrls: ['./search.component.css'],
  imports: [TableListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class SearchComponent {
  readonly config: TableListConfig = createSearchConfig();
}
