
import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { SearchResults } from 'app/models/search';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { takeWhile } from 'rxjs/operators';
import { FeaturedDocumentsTableRowsComponent } from './featured-documents-table-rows/featured-documents-table-rows.component';
import { FeaturedDocumentsService } from 'app/services/featured-documents.service';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  styleUrls: ['./featured-documents.component.scss']
})
export class FeaturedDocumentsComponent implements OnInit, OnDestroy {
  public loading = true;
  private alive = true;

  public tableData: TableObject2 = new TableObject2({ component: FeaturedDocumentsTableRowsComponent });
  public tableColumns: IColumnObject[] = [
    {
      name: '★',
      value: 'isFeatured',
      width: 'col-1',
      nosort: true
    },
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-3',
      nosort: true
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-2',
      nosort: true
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2',
      nosort: true
    },
    {
      name: 'Milestone',
      value: 'milestone',
      width: 'col-2',
      nosort: true
    },
    {
      name: 'Phase',
      value: 'phase',
      width: 'col-2',
      nosort: true
    }
  ];

  constructor(
    public location: Location,
    private featuredDocumentsService: FeaturedDocumentsService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = false;
    this.tableData.options.showPagination = false;
    this.tableData.options.showPageSizePicker = false;

    this.tableData.tableId = 'documents-table';

    this.tableData.currentPage = 1;
    this.tableData.pageSize = 5;
    this.tableData.sortBy = '-datePosted';

    this.featuredDocumentsService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {

      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        return { rowData: record };
      });

      this.tableData.columns = this.tableColumns;
      this.loading = false;

      this._changeDetectionRef.detectChanges();
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}

