import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { takeWhile } from 'rxjs/operators';

import { SearchResults } from 'app/models/search';
import { TableService } from 'app/services/table.service';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { NewsListTableRowsComponent } from './news-list-table-rows/news-list-table-rows.component';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrl: './news.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableTemplateComponent]
})
export class NewsListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);

  private tableId = 'news';
  private alive = true;
  private isSearch = false;

  loading = signal<boolean>(true);
  queryParams = signal<Params>({});
  tableData = signal<TableObject>(new TableObject({ component: NewsListTableRowsComponent }));
  
  tableColumns: IColumnObject[] = [
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

  ngOnInit(): void {
    const currentTableData = this.tableData();
    currentTableData.options.showPageCountDisplay = true;
    currentTableData.options.showPagination = true;
    this.tableData.set(currentTableData);

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params = (data as any)['params'] || {};
      this.queryParams.set({ ...params });
      
      let updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData());

      if (updatedTableData.sortBy === '-datePosted') {
        updatedTableData.sortBy = '-dateAdded';
      }

      this.tableData.set(updatedTableData);
    });

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults.data !== 0) {
        const currentTableData = this.tableData();
        currentTableData.totalListItems = searchResults.totalSearchCount;
        currentTableData.items = searchResults.data.map((record: any) => {
          return { rowData: record };
        });
        currentTableData.columns = this.tableColumns;
        currentTableData.options.showAllPicker = true;

        this.tableData.set(currentTableData);
        this.loading.set(false);
      }
    });
  }

  sortDateDescending(): ITableMessage {
    return {
      label: 'columnSort',
      data: 'dateAdded'
    };
  }

  onMessageOut(msg: ITableMessage): void {
    const params: Record<string, any> = {};
    const currentTableData = this.tableData();
    
    switch (msg.label) {
      case 'columnSort':
        if (this.isSearch) {
          params['sortBy'] = '-' + msg.data;
          this.isSearch = false;
        } else {
          if (currentTableData.sortBy.charAt(0) === '+') {
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
        if (params['pageSize'] === currentTableData.totalListItems) {
          this.loading.set(true);
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

  submit(params: Record<string, any>): void {
    this.router.navigate(
      [],
      {
        queryParams: params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.tableService.refreshData(this.tableId);
  }

  executeSearch(searchPackage: any): void {
    this.isSearch = true;
    const params: Record<string, any> = {};
    
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.tableService.data[this.tableId].cachedConfig.keywords = params['keywords'];
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

  ngOnDestroy(): void {
    this.alive = false;
  }
}
