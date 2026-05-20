import { Component, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-search-activity-table-rows]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink],
  template: `
    <td data-label="Headline" class="col-4">{{ rowData.headline }}</td>
    <td data-label="Project" class="col-3">
      @if (rowData.projectId) {
        <a [routerLink]="['/p', rowData.projectId, 'project-details']"
           [attr.aria-label]="'Link to project ' + rowData.projectName">{{ rowData.projectName }}</a>
      }
    </td>
    <td data-label="Type" class="col-2">{{ rowData.type || '-' }}</td>
    <td data-label="Date" class="col-3">
      @if (rowData._dateAdded) {
        {{ rowData._dateAdded | date:'longDate' }}
      }
    </td>
  `,
})
export class SearchActivityTableRowsComponent implements TableRowComponent {
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
}
