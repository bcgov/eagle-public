import { Component, Input, Output, OnInit, EventEmitter } from '@angular/core';

import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Router } from '@angular/router';
import { ApiService } from 'app/services/api';
import { Utils } from 'app/shared/utils/utils';

@Component({
  selector: 'tbody[app-pins-table-rows]',
  templateUrl: './pins-table-rows.component.html',
  styleUrls: ['./pins-table-rows.component.scss']
})

export class PinsTableRowsComponent implements OnInit, TableComponent {
  @Input() data: TableObject;
  @Output() selectedCount: EventEmitter<any> = new EventEmitter();

  public contacts: any;
  public paginationData: any;

  constructor(
    private api: ApiService,
    private router: Router,
    private utils: Utils
  ) { }

  ngOnInit() {
    this.contacts = this.data.data;
    this.paginationData = this.data.paginationData;
  }

  selectItem(item) {
    item.checkbox = !item.checkbox;

    let count = 0;
    this.contacts.map(doc => {
      if (doc.checkbox === true) {
        count++;
      }
    });
    this.selectedCount.emit(count);
  }

  goToItem(item) {
    // let filename = item.documentFileName;
    // let safeName = filename;
    // try {
      // safeName = this.utils.encodeFilename(filename, true);
    // } catch (e) {
    //   console.log('error:', e);
    // }
    // window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
  }
}
