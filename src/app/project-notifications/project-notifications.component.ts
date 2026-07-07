import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TableListComponent } from 'app/shared/components/table-list/table-list.component';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { createProjectNotificationsConfig } from './project-notifications.config';

@Component({
  selector: 'app-project-notifications',
  template: '<app-table-list [config]="config" />',
  imports: [TableListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ProjectNotificationsListComponent {
  readonly config: TableListConfig = createProjectNotificationsConfig();
}
