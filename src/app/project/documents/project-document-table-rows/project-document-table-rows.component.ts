import { Component, OnDestroy, OnInit } from '@angular/core';
import { Utils } from 'app/shared/utils/utils';
import { TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';
import { ConfigService } from 'app/services/config.service';
import { takeWhile } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
  selector: 'tr[app-document-table-rows]',
  templateUrl: './project-document-table-rows.component.html',
  styleUrls: ['./project-document-table-rows.component.scss']
})

export class DocumentTableRowsComponent extends TableRowComponent implements OnInit, OnDestroy {
  private lists: any[] = [];
  private alive = true;
  public currentUrl: String = '';

  constructor(
    private configService: ConfigService,
    private utils: Utils,
    private router: Router
  ) {
    super();
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
    // Grab the item from the constant lists, returning the name field of the object.
    let item = this.lists.filter(listItem => listItem._id === id);
    if (item.length !== 0) {
      return item[0].name;
    } else {
      return '-';
    }
  }

  goToItem(item) {
    let filename = item.documentFileName || item.displayName || item.internalOriginalName;
    let safeName = filename;
    try {
      safeName = this.utils.encodeString(filename, true)
    } catch (e) {
      console.log('error:', e);
    }
    window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
