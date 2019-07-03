import { Component, Input, Output, OnInit, EventEmitter } from '@angular/core';

import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Router } from '@angular/router';
import { ApiService } from 'app/services/api';

const encode = encodeURIComponent;
window['encodeURIComponent'] = (component: string) => {
  return encode(component).replace(/[!'()*]/g, (c) => {
    // Also encode !, ', (, ), and *
    return '%' + c.charCodeAt(0).toString(16);
  });
};

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
    private router: Router
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
    //   safeName = encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/\%2F/g, '_');
    // } catch (e) {
    //   console.log('error:', e);
    // }
    // window.open('/api/document/' + item._id + '/fetch/' + safeName, '_blank');
  }
}
