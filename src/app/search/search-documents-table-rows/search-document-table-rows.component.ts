import { Component, OnDestroy, inject, output } from '@angular/core';
import { Subject } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-document-table-rows]',
  templateUrl: './search-document-table-rows.component.html',
  styleUrls: ['./search-document-table-rows.component.css'],
  imports: [
    CommonModule,
    DatePipe,
    RouterLink
  ],
  providers: [DatePipe],
})
export class DocSearchTableRowsComponent implements TableRowComponent, OnDestroy {
  private alive = true;
  private utils = inject(Utils);

  // Required by TableRowComponent interface
  rowData: any;
  tableData!: TableObject;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();

  // Get lists from tableData.data (passed from parent, no HTTP subscription)
  private get lists(): any[] {
    return this.tableData?.data?.lists || [];
  }

  idToList(id: string): string {
    return this.utils.idToListName(id, this.lists);
  }

  goToItem(item: any) {
    this.utils.openDocumentDownload(item);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
