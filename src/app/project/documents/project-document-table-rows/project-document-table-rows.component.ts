import { Component, OnDestroy, OnInit, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTableRowsComponent implements TableRowComponent, OnInit, OnDestroy {
  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);

  // TableRowComponent properties
  rowData: any;
  tableData: any;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  private lists: any[] = [];
  private alive = true;
  public currentUrl: string = '';

  constructor() {
    let currRoute = this.router.url.split(';')[0];
    this.currentUrl = currRoute.substring(currRoute.lastIndexOf('/') + 1);
  }

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
      console.log('error:', e);
    }
    window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
