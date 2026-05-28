import { Component, DestroyRef, inject, ChangeDetectionStrategy, signal, output } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Utils } from '../../../shared/utils/utils';
import { TableRowComponent, ITableMessage } from '../../../shared/components/table-template/table-row-component';
import { ConfigService } from '../../../services/config.service';

@Component({
  selector: 'app-document-table-rows',
  templateUrl: './project-document-table-rows.component.html',
  styleUrls: ['./project-document-table-rows.component.css'],
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTableRowsComponent implements TableRowComponent {
  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  rowData: any;
  tableData: any;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();

  private readonly lists = signal<any[]>([]);
  public currentUrl: string;

  constructor() {
    const currRoute = this.router.url.split(';')[0];
    this.currentUrl = currRoute.substring(currRoute.lastIndexOf('/') + 1);

    this.configService.lists
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        if (list && list.length > 0) {
          this.lists.set(list);
        }
      });
  }

  idToList(id: string): string {
    return this.utils.idToListName(id, this.lists());
  }

  goToItem(item: any): void {
    this.utils.openDocumentDownload(item);
  }
}
