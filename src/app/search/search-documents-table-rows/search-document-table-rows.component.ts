import { Component, OnInit, OnDestroy } from '@angular/core';
import { Utils } from 'app/shared/utils/utils';
import { TableRowComponent } from 'app/shared/components/table-template/table-row-component';
import { ConfigService } from 'app/services/config.service';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'tr[app-document-table-rows]',
  templateUrl: './search-document-table-rows.component.html',
  styleUrls: ['./search-document-table-rows.component.scss']
})

export class DocSearchTableRowsComponent extends TableRowComponent implements OnInit, OnDestroy {
  private lists: any[] = [];
  private alive = true;

  constructor(
    public configService: ConfigService,
    private utils: Utils
  ) {
    super();
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
    const items = this.lists.filter(listItem => listItem._id === id);
    if (items.length !== 0) {
      return items[0].name;
    } else {
      return '-';
    }
  }

  goToItem(item) {
    const filename = item.documentFileName || item.displayName || item.internalOriginalName;
    let safeName = filename;
    try {
      safeName = this.utils.encodeString(filename, true)
    } catch (e) {
      console.log('error:', e);
    }
    window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
  }

  goToProject(item) {
    window.open('/p/' + item.project._id + '/project-details');
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
