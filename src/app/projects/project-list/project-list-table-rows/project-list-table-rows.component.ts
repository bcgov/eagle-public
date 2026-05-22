import { Component, EventEmitter, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { AnalyticsService } from 'app/services/analytics/analytics.service';

@Component({
  selector: 'app-project-list-table-rows',
  templateUrl: './project-list-table-rows.component.html',
})
export class ProjectListTableRowsComponent implements TableRowComponent {
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  // TableRowComponent interface properties
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  goToProject(project: any): void {
    // Track project view from list
    this.analytics.track('Project Viewed', {
      project_id: project._id,
      project_name: project.name,
      source: 'list_view'
    });
    
    this.router.navigate([`p/${project._id}/project-details`]);
  }
}
