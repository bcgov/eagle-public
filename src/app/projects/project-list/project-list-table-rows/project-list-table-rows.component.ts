import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TableRowComponent } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-project-list-table-rows',
  templateUrl: './project-list-table-rows.component.html',
  styleUrls: ['./project-list-table-rows.component.css'],
  imports: [CommonModule]
})
export class ProjectListTableRowsComponent implements TableRowComponent {
  private router = inject(Router);

  // TableRowComponent interface properties
  rowData: any;
  tableData!: TableObject;
  messageOut: any;
  messageIn: any;

  goToProject(project: any) {
    this.router.navigate([`p/${project._id}/project-details`]);
  }
}
