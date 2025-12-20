import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ConfigService } from 'app/services/config.service';
import { TableService } from 'app/services/table.service';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { Constants } from 'app/shared/utils/constants';
import { takeWhile, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { DocSearchTableRowsComponent } from './search-documents-table-rows/search-document-table-rows.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchParamObject } from 'app/services/search.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
  imports: [
    CommonModule,
    RouterModule,
    TableTemplateComponent,
    SearchFilterTemplateComponent
  ],
  standalone: true
})
export class SearchComponent implements OnInit, OnDestroy {
  private tableId = 'search';
  private lists: any[] = [];
  private alive = true;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private configService = inject(ConfigService);

  queryParams = signal<Params>({});
  showAdvancedFilters = signal(false);

  tableColumns = signal<IColumnObject[]>([
    {
      name: 'Document Name',
      value: 'displayName',
      width: 'col-4'
    },
    {
      name: 'Project',
      value: 'project.name',
      width: 'col-2'
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-2'
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2'
    },
    {
      name: 'Milestone',
      value: 'milestone',
      width: 'col-2'
    },
    {
      name: 'Download',
      value: '',
      width: 'col-1',
      nosort: true,
    },
  ]);

  filters = signal<FilterObject[]>([]);
  tableData = signal<TableObject>(new TableObject({ component: DocSearchTableRowsComponent }));

  private legislationFilterGroup = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };
  private milestoneArray = signal<any[]>([]);
  private documentAuthorTypeArray = signal<any[]>([]);
  private documentTypeArray = signal<any[]>([]);
  private projectPhaseArray = signal<any[]>([]);
  private filtersList = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
  private dateFiltersList = ['datePostedStart', 'datePostedEnd'];
  private tableSignal = this.tableService.getTableSignal(this.tableId);
  private tableSignal$ = toObservable(this.tableSignal);

  hasResults = computed(() => 
    this.tableData().totalListItems > 0
  );

  constructor() {}

  ngOnInit() {
    // Watch table signal for updates
    this.tableSignal$
      .pipe(
        takeWhile(() => this.alive),
        skip(1)
      )
      .subscribe(searchResults => {
        if (searchResults && searchResults.data && searchResults.data !== 0) {
          const currentTableData = this.tableData();
          currentTableData.totalListItems = searchResults.totalSearchCount;
          currentTableData.items = searchResults.data.map((record: any) => {
            return { rowData: record };
          });
          currentTableData.columns = this.tableColumns();
          currentTableData.options.showAllPicker = true;

          this.tableData.set(currentTableData);
        }
      });

    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list: any[]) => {
      this.lists = list;
      const milestones: any[] = [];
      const authors: any[] = [];
      const docTypes: any[] = [];
      const phases: any[] = [];

      list.forEach((item: any) => {
        if (item.type === 'label') {
          milestones.push({ ...item });
        } else if (item.type === 'author') {
          authors.push({ ...item });
        } else if (item.type === 'doctype') {
          docTypes.push({ ...item });
        } else if (item.type === 'projectPhase') {
          phases.push({ ...item });
        }
      });

      this.milestoneArray.set(milestones);
      this.documentAuthorTypeArray.set(authors);
      this.documentTypeArray.set(docTypes);
      this.projectPhaseArray.set(phases);

      this.setFilters();
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe((data: any) => {
      const params: any = {};
      data.keys.forEach((key: string) => {
        params[key] = data.get(key);
      });
      this.queryParams.set(params);
      
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData());
      this.tableData.set(updatedTableData);

      // Show advanced filters if any filter params are present
      if (this.hasFilterParams(params)) {
        this.showAdvancedFilters.set(true);
      }

      const currentTableData = this.tableData();
      const allFilters = [...this.filtersList, ...this.dateFiltersList];
      const filters = this.tableTemplateUtils.getFiltersFromParams(params, allFilters);

      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        params['keywords'] || '',
        'Document',
        [],
        currentTableData.currentPage,
        currentTableData.pageSize,
        currentTableData.sortBy,
        filters,
        false,
        ''
      ));
    });
  }

  private setFilters() {
    const docDateFilter = new FilterObject(
      'issuedDate',
      FilterType.DateRange,
      '',
      new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
      6
    );

    const milestoneFilter = new FilterObject(
      'milestone',
      FilterType.MultiSelect,
      'Milestone',
      new MultiSelectDefinition(
        this.milestoneArray(),
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      6
    );

    const documentAuthorTypeFilter = new FilterObject(
      'documentAuthorType',
      FilterType.MultiSelect,
      'Document Author',
      new MultiSelectDefinition(
        this.documentAuthorTypeArray(),
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
    );

    const documentTypeFilter = new FilterObject(
      'type',
      FilterType.MultiSelect,
      'Document Type',
      new MultiSelectDefinition(
        this.documentTypeArray(),
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
    );

    const projectPhaseFilter = new FilterObject(
      'projectPhase',
      FilterType.MultiSelect,
      'Project Phase',
      new MultiSelectDefinition(
        this.projectPhaseArray(),
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
    );

    this.filters.set([
      docDateFilter,
      milestoneFilter,
      documentAuthorTypeFilter,
      documentTypeFilter,
      projectPhaseFilter
    ]);
  }

  private hasFilterParams(params: any): boolean {
    return this.filtersList.some(filter => params[filter]) || 
           this.dateFiltersList.some(filter => params[filter]);
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage: any) {
    let params: any = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = Constants.tableDefaults.DEFAULT_SORT_BY;
    }

    params['currentPage'] = 1;

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList, this.dateFiltersList);

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    const currentTableData = this.tableData();
    
    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = this.toggleSortDirection(msg.data);
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
      default:
        break;
    }
    this.submit(params);
  }

  private toggleSortDirection(column: string): string {
    const currentTableData = this.tableData();
    if (currentTableData.sortBy.charAt(0) === '+') {
      return '-' + column;
    } else {
      return '+' + column;
    }
  }

  submit(params: any, filters: any = null) {
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
  }

  onToggleFiltersPanel(event: any) {
    this.showAdvancedFilters.set(event.showPanel);
  }

  resetSortByIfScore() {
    const currentTableData = this.tableData();
    if (currentTableData.sortBy.includes('score')) {
      currentTableData.sortBy = '-datePosted';
      this.tableData.set(currentTableData);
    }
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
