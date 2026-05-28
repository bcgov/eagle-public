import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';

import { Router, ActivatedRoute, Params } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TypesenseService } from 'app/services/typesense.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { ActivityCardComponent } from 'app/shared/components/activity-card/activity-card.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrl: './news.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableTemplateComponent, HeroBannerComponent, SearchFilterTemplateComponent],
})
export class NewsListComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private typesense = inject(TypesenseService);
  private loadingState = inject(LoadingStateService);

  private readonly loadingId = 'table-news';

  loading = this.loadingState.getOperationState(this.loadingId);
  tableData = signal<TableObject>(new TableObject({ component: ActivityCardComponent }));
  
  tableColumns: IColumnObject[] = [
    {
      name: 'Headline',
      value: 'headline',
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

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(data => {
      const params = (data as any)['params'] || {};
      
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData());
      if (updatedTableData.sortBy === '-datePosted') {
        updatedTableData.sortBy = '-dateAdded';
      }
      this.tableData.set(updatedTableData);

      this.fetchActivities(params, updatedTableData);
    });
  }

  private fetchActivities(params: Record<string, any>, tableState: TableObject): void {
    const keywords = params['keywords'] || '';
    const sortBy   = tableState.sortBy || '-dateAdded';
    const page     = tableState.currentPage || 1;
    const pageSize = tableState.pageSize || 10;

    // Convert URL sort to Typesense sort_by
    const dir = sortBy.charAt(0) === '-' ? 'desc' : 'asc';
    const field = sortBy.replace(/^[+-]/, '');
    const tsSortBy = field === 'score'
      ? '_text_match:desc,dateAdded:desc'
      : `${field}:${dir}`;

    const searchParams: Record<string, string> = {
      q:        keywords || '*',
      query_by: 'headline,content',
      sort_by:  tsSortBy,
      page:     String(page),
      per_page: String(pageSize),
    };

    this.loadingState.startLoading(this.loadingId, 'Loading activities');
    this.typesense.searchCollection('activities', searchParams)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => {
          const items = (res.hits ?? []).map((hit: any) => {
            const d = hit.document;
            return {
              rowData: {
                _id:      d.id,
                headline: d.headline,
                content:  d.contentHtml || d.content,
                dateAdded: d.dateAdded ? d.dateAdded * 1000 : null,
                type:     d.type,
                documentUrl: d.documentUrl || null,
                notificationName: d.notificationName || null,
                project: d.projectId ? { _id: d.projectId, name: d.projectName || '' } : null,
              },
            };
          });
          const newTableData = new TableObject({
            component: ActivityCardComponent,
            pageSize:    tableState.pageSize,
            currentPage: tableState.currentPage,
            sortBy:      tableState.sortBy,
          });
          newTableData.totalListItems = res.found ?? 0;
          newTableData.items = items;
          newTableData.columns = this.tableColumns;
          newTableData.options.showPageCountDisplay = true;
          newTableData.options.showPagination = true;
          newTableData.options.showAllPicker = true;
          newTableData.options.disableRowHighlight = true;
          this.tableData.set(newTableData);
          this.loadingState.stopLoading(this.loadingId);
        },
        error: () => this.loadingState.stopLoading(this.loadingId),
      });
  }

  onMessageOut(msg: ITableMessage): void {
    const params: Params = {};
    const currentParams = this.route.snapshot.queryParams;
    
    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = this.toggleSortDirection(msg.data);
        params['currentPage'] = 1;
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
    }
    
    this.submit({ ...currentParams, ...params });
  }

  private toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;
    
    // If we're sorting by the same field, toggle direction
    if (currentSort?.includes(field)) {
      return (currentSort?.[0] === '+' ? '-' : '+') + field;
    }
    
    // Default to descending for new field
    return '-' + field;
  }

  submit(params: Params): void {
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route
    });
  }

  executeSearch(searchEvent: any): void {
    const params: Params = {
      ...this.route.snapshot.queryParams,
      currentPage: 1
    };
    
    if (searchEvent.keywords) {
      params['keywords'] = searchEvent.keywords;
    } else {
      delete params['keywords'];
    }
    
    this.submit(params);
  }
}
