import { Component, ViewEncapsulation, ChangeDetectionStrategy, inject, signal, EventEmitter } from '@angular/core';

import { ResponsiveService } from '../../services/responsive.service';

import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { ProjectNotificationDocumentsTableDetailsComponent } from '../project-notification-documents-table-details/project-notification-documents-table-details.component';
import { ProjectNotificationDocumentsTableComponent } from '../project-notification-documents-table/project-notification-documents-table.component';

@Component({
  selector: 'tr[app-project-notifications-table-rows]',
  templateUrl: './project-notifications-table-rows.component.html',
  styleUrls: ['./project-notifications-table-rows.component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProjectNotificationDocumentsTableDetailsComponent,
    ProjectNotificationDocumentsTableComponent
],
})
export class ProjectNotificationsTableRowsComponent implements TableRowComponent {
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
  
  private responsive = inject(ResponsiveService);

  isMobile = this.responsive.isMobile;
  activeTab = signal<'details' | 'documents'>('details');
  documentsTabLoaded = signal(false);

  setActiveTab(tab: 'details' | 'documents') {
    this.activeTab.set(tab);
    if (tab === 'documents' && !this.documentsTabLoaded()) {
      this.documentsTabLoaded.set(true);
    }
  }
}
