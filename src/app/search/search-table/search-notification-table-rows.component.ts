import { Component, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-search-notification-table-rows]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <td data-label="Name" class="col-3">{{ rowData.name || '-' }}</td>
    <td data-label="Type" class="col-2">{{ rowData.type || '-' }}</td>
    <td data-label="Sub-Type" class="col-2">{{ rowData.subType || '-' }}</td>
    <td data-label="Region" class="col-2">{{ rowData.region || '-' }}</td>
    <td data-label="Date" class="col-3">
      @if (rowData._receivedDate) {
        {{ rowData._receivedDate | date:'longDate' }}
      } @else {
        -
      }
    </td>
  `,
})
export class SearchNotificationTableRowsComponent implements TableRowComponent {
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
}
