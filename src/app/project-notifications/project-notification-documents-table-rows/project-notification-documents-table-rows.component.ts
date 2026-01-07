import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, inject, EventEmitter } from '@angular/core';
import { takeWhile } from 'rxjs/operators';
import { CommonModule, DatePipe } from '@angular/common';

import { ConfigService } from '../../services/config.service';
import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { Utils } from '../../shared/utils/utils';
import { LoggingService } from '../../services/logging.service';

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
  private logger = inject(LoggingService);

  private lists: any[] = [];
  private alive = true;

  ngOnInit() {
    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists = list;
    });
  }

  idToList(id: string) {
    if (!id) {
      return '-';
    }
    const items = this.lists.filter(listItem => listItem._id === id);
    if (items.length !== 0) {
      return items[0].name;
    } else {
      return '-';
    }
  }

  goToItem(item: any) {
    const filename = item.documentFileName || item.displayName || item.internalOriginalName;
    let safeName = filename;
    try {
      safeName = this.utils.encodeString(filename, true);
    } catch (e) {
      this.logger.error('Error encoding filename', 'ProjectNotificationsTableRows', e);
      safeName = filename; // Fallback to original filename
    }
    window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
