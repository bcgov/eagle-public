import { Component, OnDestroy, OnInit, EventEmitter, inject, ChangeDetectionStrategy, signal, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeWhile } from 'rxjs/operators';
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
  standalone: true
})
export class DocumentTableRowsComponent implements TableRowComponent, OnInit, OnDestroy {
  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  // TableRowComponent properties
  rowData: any;
  tableData: any;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  private lists = signal<any[]>([]);
  private alive = true;
  public currentUrl: string;

  constructor() {
    const currRoute = this.router.url.split(';')[0];
    this.currentUrl = currRoute.substring(currRoute.lastIndexOf('/') + 1);
  }

  ngOnInit() {
    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      if (list && list.length > 0) {
        this.lists.set(list);
        // Trigger change detection when lists are loaded
        this.cdr.markForCheck();
      }
    });
  }

  idToList(id: string): string {
    if (!id) return '-';
    
    const currentLists = this.lists();
    if (!currentLists?.length) return '-';
    
    const item = currentLists.find(listItem => listItem._id === id);
    return item?.name ?? '-';
  }

  goToItem(item: any): void {
    const filename = item.documentFileName || item.displayName || item.internalOriginalName;
    const safeName = this.utils.encodeString(filename, true);
    window.open(`/api/public/document/${item._id}/download/${safeName}`, '_blank');
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
