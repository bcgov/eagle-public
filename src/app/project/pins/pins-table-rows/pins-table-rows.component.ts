import { Component, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-pins-table-rows]',
  templateUrl: './pins-table-rows.component.html',
  imports: [CommonModule],
  standalone: true
})
export class PinsTableRowsComponent implements TableRowComponent {
  // TableRowComponent interface properties
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
}
