import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { TableService } from 'app/services/table.service';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { takeWhile } from 'rxjs/operators';
import { NewsListTableRowsComponent } from './news-list-table-rows/news-list-table-rows.component';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss']
})

export class NewsListComponent implements OnInit, OnDestroy {
  private tableId = 'news';
  public loading = true;
  private alive = true;
  public queryParams: Params;
  private isSearch = false;

  public tableData: TableObject2 = new TableObject2({ component: NewsListTableRowsComponent });
  public tableColumns: IColumnObject[] = [
    {
      name: 'Headline',
      value: 'headine',
      width: 'col-10',
      nosort: true
    },
    {
      name: 'Date',
      value: 'dateAdded',
      width: 'col-2',
      nosort: false
    }
  ];
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplate,
    private tableService: TableService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData);

      if (this.tableData.sortBy === '-datePosted') {
        this.tableData.sortBy = '-dateAdded';
      }

      this._changeDetectionRef.detectChanges();
    });

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map(record => {
          return { rowData: record };
        });
        this.tableData.columns = this.tableColumns;
        this.tableData.options.showAllPicker = true;

        this.loading = false;
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  sortDateDescending(): ITableMessage {
    return {
      label: 'columnSort',
      data: 'dateAdded'
    }
  }

  onMessageOut(msg: ITableMessage) {
    let params = {};
    switch (msg.label) {
      case 'columnSort':
        if (this.isSearch) {
          params['sortBy'] = '-' + msg.data;
          this.isSearch = false;
        } else {
          if (this.tableData.sortBy.charAt(0) === '+') {
            params['sortBy'] = '-' + msg.data;
          } else {
            params['sortBy'] = '+' + msg.data;
          }
        }
        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loading = true;
        }
        params['currentPage'] = 1;
        this.tableService.data[this.tableId].cachedConfig.pageSize = params['pageSize'];
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params) {
    this.router.navigate(
      [],
      {
        queryParams: params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.tableService.refreshData(this.tableId);
  }

  executeSearch(searchPackage) {
    this.isSearch = true;
    let params = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.tableService.data[this.tableId].cachedConfig.keywords = params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-dateAdded';
      this.tableService.data[this.tableId].cachedConfig.keywords = '';
      this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
    }
    params['currentPage'] = 1;
    this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
    this.submit(params);
    this.onMessageOut(this.sortDateDescending());
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
