import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, inject, EventEmitter } from '@angular/core';
import { takeWhile } from 'rxjs/operators';
import { CommonModule, DatePipe } from '@angular/common';

import { ConfigService } from '../../services/config.service';
import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { Utils } from '../../shared/utils/utils';

@Component({
  selector: 'app-project-notification-documents-table-rows',
  templateUrl: './project-notification-documents-table-rows.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],
  standalone: true,
  host: {
    '(keyup.enter)': 'goToItem(rowData)',
    'tabindex': '0'
  }
})
export class ProjectNotificationDocumentsTableRowsComponent implements TableRowComponent, OnInit, OnDestroy {
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
  
  private configService = inject(ConfigService);
  private utils = inject(Utils);

  private lists: any[] = [];
  private alive = true;

  ngOnInit() {
    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists = list;
    });
  }

  idToList(id: string) {
    return this.utils.idToListName(id, this.lists);
  }

  goToItem(item: any) {
    this.utils.openDocumentDownload(item);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
