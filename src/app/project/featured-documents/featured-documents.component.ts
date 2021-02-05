import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { IPageSizePickerOption } from 'app/shared/components/page-size-picker/page-size-picker.component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { takeWhile } from 'rxjs/operators';
import { StorageService } from 'app/services/storage.service';
import { FeaturedDocumentsTableRowsComponent } from './featured-documents-table-rows/featured-documents-table-rows.component';
import { FeaturedDocumentsService } from 'app/services/featured-documents.service';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  styleUrls: ['./featured-documents.component.scss']
})
export class FeaturedDocumentsComponent implements OnInit, OnDestroy {
  public loading = true;
  private currentProject;
  private alive = true;
  public queryParams: Params;

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
    private router: Router,
    public location: Location,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplate,
    private featuredDocumentsService: FeaturedDocumentsService,
    private storageService: StorageService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.currentProject = this.storageService.state.currentProject.data;

    this.tableData.options.showPageCountDisplay = false;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // This will always grab defaults for tableObject
      // URL is never set for featured documents
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData, 'Docs');

      this._changeDetectionRef.detectChanges();
    });

    this.featuredDocumentsService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {

      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        return { rowData: record };
      });

      if (this.tableData.totalListItems > 10) {
        this.tableData.options.showPageSizePicker = true;
      } else {
        this.tableData.options.showPageSizePicker = false;
      }

      this.tableData.columns = this.tableColumns;
      this.loading = false;

      this._changeDetectionRef.detectChanges();
    });
  }

  onMessageOut(msg: ITableMessage) {
    switch (msg.label) {
      case 'rowClicked':
        break;
      case 'rowSelected':
        break;
      case 'columnSort':
        this.setColumnSort(msg.data);
        break;
      case 'pageNum':
        this.onPageNumUpdate(msg.data);
        break;
      case 'pageSize':
        this.onPageSizeUpdate(msg.data);
        break;
      default:
        break;
    }
  }

  setColumnSort(column) {
    if (this.tableData.sortBy.charAt(0) === '+') {
      this.tableData.sortBy = '-' + column;
    } else {
      this.tableData.sortBy = '+' + column;
    }
    this.submit();
  }

  onPageNumUpdate(pageNumber) {
    this.tableData.currentPage = pageNumber;
    this.submit();
  }

  onPageSizeUpdate(pageSize: IPageSizePickerOption) {
    this.tableData.pageSize = pageSize.value;
    this.submit();
  }

  async submit() {
    delete this.queryParams.sortBy;
    delete this.queryParams.currentPage;
    delete this.queryParams.pageNumber;
    delete this.queryParams.pageSize;


    // This allows us to have multiple tables tied to a single page.
    const encodedParams = {
      currentPageDocs: this.tableData.currentPage,
      pageSizeDocs: this.tableData.pageSize,
      sortByDocs: this.tableData.sortBy
    };

    this.router.navigate(
      ['../project-details'],
      {
        queryParams: encodedParams,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      }
    );

    await this.featuredDocumentsService.fetchData(
      '',
      this.tableData.currentPage,
      this.tableData.pageSize,
      this.tableData.sortBy,
      this.currentProject._id
    );
  }

  ngOnDestroy() {
    this.alive = false;
  }
}

