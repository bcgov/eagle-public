import { Component, OnInit, OnDestroy, EventEmitter, inject, signal, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Utils } from 'app/shared/utils/utils';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { ConfigService } from 'app/services/config.service';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'tr[app-document-table-rows]',
  templateUrl: './search-document-table-rows.component.html',
  styleUrls: ['./search-document-table-rows.component.css'],
  imports: [
    CommonModule
  ],
  standalone: true
})
export class DocSearchTableRowsComponent implements TableRowComponent, OnInit, OnDestroy {
  private alive = true;
  private configService = inject(ConfigService);
  private utils = inject(Utils);

  // Required by TableRowComponent interface
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  lists = signal<any[]>([]);

  ngOnInit() {
    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists.set(list);
    });
  }

  idToList(id: string): string {
    if (!id) {
      return '-';
    }
    // Grab the item from the constant lists, returning the name field of the object.
    const items = this.lists().filter(listItem => listItem._id === id);
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

  goToProject(item: any) {
    window.open('/p/' + item.project._id + '/project-details');
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
