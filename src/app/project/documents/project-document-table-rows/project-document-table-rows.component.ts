import { Component, Input, Output, OnInit, OnDestroy, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Router, ActivatedRoute } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';

@Component({
  selector: 'tbody[app-document-table-rows]',
  templateUrl: './project-document-table-rows.component.html',
  styleUrls: ['./project-document-table-rows.component.scss']
})

export class DocumentTableRowsComponent implements OnInit, OnDestroy, TableComponent {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  @Input() data: TableObject;
  @Output() selectedCount: EventEmitter<any> = new EventEmitter();

  public documents: any;
  public paginationData: any;
  public showFeatured = true;
  private lists: any[] = [];

  public currentUrl: String = '';

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private utils: Utils
  ) {
    let currRoute = this.router.url.split(';')[0];
    this.currentUrl = currRoute.substring(currRoute.lastIndexOf('/') + 1);
   }

  ngOnInit() {
    this.documents = this.data.data;
    this.paginationData = this.data.paginationData;
    if (this.data.extraData) {
      this.showFeatured = this.data.extraData.showFeatured;
    }

    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res) {
          if (res.documentsTableRow && res.documentsTableRow.length > 0) {
            this.lists = res.documentsTableRow[0].searchResults;
          } else if (res.documents && res.documents.length > 0) {
            this.lists = res.documents[0].data.searchResults;
          } else {
            alert('Uh-oh, couldn\'t load list');
            this.lists = [];
          }
          this._changeDetectionRef.detectChanges();
        }
      });
  }
  // idToList is replacement for list-converter.pipe.ts, add it is because this.config.list doesn't always load properly
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
  selectItem(item) {
    item.checkbox = !item.checkbox;

    let count = 0;
    this.documents.map(doc => {
      if (doc.checkbox === true) {
        count++;
      }
    });
    this.selectedCount.emit(count);
  }

  goToItem(item) {
    let filename = item.documentFileName;
    let safeName = filename;
    try {
      safeName = this.utils.encodeString(filename, true)
    } catch (e) {
      console.log('error:', e);
    }
    window.open('/api/public/document/' + item._id + '/download/' + safeName, '_blank');
  }
  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
