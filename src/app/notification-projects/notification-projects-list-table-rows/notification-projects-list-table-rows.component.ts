import { Component, Input, OnInit } from '@angular/core';

import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';

import { ApiService } from 'app/services/api';

@Component({
  selector: 'tbody[app-notification-projects-list-table-rows]',
  templateUrl: './notification-projects-list-table-rows.component.html',
  styleUrls: ['./notification-projects-list-table-rows.component.scss']
})

export class NotificationProjectsListTableRowsComponent implements OnInit, TableComponent {
  @Input() data: TableObject;

  public items: any;
  public paginationData: any;

  constructor(
    private api: ApiService
  ) { }

  ngOnInit() {
    this.items = this.data.data;
    this.paginationData = this.data.paginationData;
  }

  public downloadDocument(document) {
    document.displayName = document.documentFileName;
    return this.api.downloadDocument(document).then(() => {
      console.log('Download initiated for file(s)');
    });
  }
}
