import { Component, output } from '@angular/core';
import { Subject } from 'rxjs';

import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-pins-table-rows]',
  templateUrl: './pins-table-rows.component.html',
  imports: [],
})
export class PinsTableRowsComponent implements TableRowComponent {
  // TableRowComponent interface properties
  rowData: any;
  tableData!: TableObject;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();
}
