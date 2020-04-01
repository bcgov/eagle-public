import { Component, Input, Output, OnInit, OnDestroy, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { ActivatedRoute } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';
import { MatSnackBarRef, SimpleSnackBar, MatSnackBar } from '@angular/material';

@Component({
  selector: 'tbody[app-document-table-rows]',
  templateUrl: './search-document-table-rows.component.html',
  styleUrls: ['./search-document-table-rows.component.scss']
})

export class DocSearchTableRowsComponent implements OnInit, OnDestroy, TableComponent {
  @Input() data: TableObject;
  @Output() selectedCount: EventEmitter<any> = new EventEmitter();

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public documents: any;
  public paginationData: any;
  public showFeatured = true;
  private lists: any[] = [];

  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;

  constructor(
    public snackBar: MatSnackBar,
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private utils: Utils
  ) { }

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
          if (res.documentsTableRows && res.documentsTableRows.length > 0) {
            this.lists = res.documentsTableRows[0].searchResults;
          } else if (res.documents && res.documents.length > 0) {
            this.lists = res.documents[0].data.searchResults;
          } else {
            this.snackBar.open('Error loading document list');
            window.setTimeout(() => this.snackBar.dismiss(), 2000)
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

  goToProject(item) {
    window.open('/p/' + item.project._id + '/project-details');
  }

  ngOnDestroy() {
    if (this.snackBarRef) { this.snackBarRef.dismiss(); }
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
