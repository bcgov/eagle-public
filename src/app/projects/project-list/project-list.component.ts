import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TableListComponent } from 'app/shared/components/table-list/table-list.component';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { createProjectListConfig } from './project-list.config';

@Component({
  selector: 'app-project-list',
  template: '<app-table-list [config]="config" />',
  styleUrls: ['./project-list.component.css'],
  imports: [TableListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent {
  readonly config: TableListConfig = createProjectListConfig();
}
