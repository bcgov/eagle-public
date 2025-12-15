import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableRowComponent } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-pins-table-rows]',
  templateUrl: './pins-table-rows.component.html',
  styleUrls: ['./pins-table-rows.component.css'],
  imports: [CommonModule]
})
export class PinsTableRowsComponent implements TableRowComponent {
  // TableRowComponent interface properties
  rowData: any;
  tableData!: TableObject;
  messageOut: any;
  messageIn: any;
}
