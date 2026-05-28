import { Component, DestroyRef, ChangeDetectionStrategy, inject, signal, output } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { ConfigService } from '../../services/config.service';
import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { Utils } from '../../shared/utils/utils';

@Component({
  selector: 'app-project-notification-documents-table-rows',
  templateUrl: './project-notification-documents-table-rows.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  host: {
    '(keyup.enter)': 'goToItem(rowData)',
    'tabindex': '0'
  }
})
export class ProjectNotificationDocumentsTableRowsComponent implements TableRowComponent {
  rowData: any;
  tableData!: TableObject;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();

  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  private readonly lists = signal<any[]>([]);

  constructor() {
    this.configService.lists
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.lists.set(list));
  }

  idToList(id: string) {
    return this.utils.idToListName(id, this.lists());
  }

  goToItem(item: any) {
    this.utils.openDocumentDownload(item);
  }
}
