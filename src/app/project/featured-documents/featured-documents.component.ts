
import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { SearchResults } from 'app/models/search';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { takeWhile } from 'rxjs/operators';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableService } from 'app/services/table.service';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  styleUrls: ['./featured-documents.component.scss']
})
export class FeaturedDocumentsComponent implements OnInit, OnDestroy {
  public loading = true;
  private alive = true;
  private tableId = 'featuredDocuments';

  public tableData: TableObject = new TableObject({ component: DocumentTableRowsComponent });
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
      value: 'projectPhase',
      width: 'col-2',
      nosort: true
    }
  ];

  constructor(
    public location: Location,
    private tableService: TableService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = false;
    this.tableData.options.showPagination = false;
    this.tableData.options.showPageSizePicker = false;

    this.tableData.tableId = 'documents-table';

    this.tableData.currentPage = 1;
    this.tableData.pageSize = 5;
    this.tableData.sortBy = '-datePosted';

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map(record => {
          record['showFeatured'] = true;
          return { rowData: record };
        });

        this.tableData.columns = this.tableColumns;
        this.loading = false;

        this._changeDetectionRef.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}

