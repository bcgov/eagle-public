import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { takeWhile } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';
import { LoadingStateService } from '../../services/loading-state.service';
import { ConfigService } from '../../services/config.service';
import { Utils } from '../../shared/utils/utils';
import { Constants } from '../../shared/utils/constants';

@Component({
  selector: 'app-amendments',
  templateUrl: './amendments.component.html',
  styleUrls: ['./amendments.component.css'],
  imports: [TableTemplateComponent, SearchFilterTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class AmendmentsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableTemplateUtils = inject(TableTemplate);
  private readonly tableService = inject(TableService);
  private readonly loadingState = inject(LoadingStateService);
  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);

  private readonly tableId = 'amendments';
  private alive = true;
  private projId = '';
  private lists: any[] = [];

  private readonly milestoneArray: any[] = [];
  private readonly documentTypeArray: any[] = [];
  private readonly projectPhaseArray: any[] = [];
  private readonly filtersList = ['milestone', 'type', 'projectPhase'];
  private readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];

  public queryParams: Params = {};
  public readonly showAdvancedFilters = signal(false);
  public readonly filters = signal<FilterObject[]>([]);

  public readonly loading = this.loadingState.getOperationState('table-amendments');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));
  private readonly tableSignal$ = toObservable(this.tableService.getTableSignal(this.tableId));
  
  public readonly tableColumns: IColumnObject[] = [
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-4'
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
      name: 'Phase',
      value: 'projectPhase',
      width: 'col-2'
    }
  ];

  ngOnInit() {
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    // Watch for table data changes from service
    this.tableSignal$.pipe(takeWhile(() => this.alive)).subscribe(searchResults => {
      
      if (searchResults && searchResults.data) {
        const currentTableData = this.tableData();
        const newTableData = new TableObject({
          component: DocumentTableRowsComponent,
          pageSize: currentTableData.pageSize,
          currentPage: currentTableData.currentPage,
          sortBy: currentTableData.sortBy
        });

        newTableData.totalListItems = searchResults.totalSearchCount;
        newTableData.items = searchResults.data.map((record: any) => {
          record.showFeatured = false;
          return { rowData: record };
        });
        newTableData.columns = this.tableColumns;
        newTableData.options.showAllPicker = true;

        this.tableData.set(newTableData);
      }
    });

    // Load config lists and trigger initial fetch
    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe(list => {
      this.lists = list;
      
      // Populate filter arrays from config lists
      this.lists.forEach(item => {
        switch (item.type) {
          case 'label':
            this.milestoneArray.push({ ...item });
            break;
          case 'doctype':
            this.documentTypeArray.push({ ...item });
            break;
          case 'projectPhase':
            this.projectPhaseArray.push({ ...item });
            break;
        }
      });
      this.setFilters();
      this.fetchDataWithCurrentParams();
    });

    // Subscribe to query params and fetch data
    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(() => {
      if (this.lists.length > 0) {
        this.fetchDataWithCurrentParams();
      }
    });
  }

  private fetchDataWithCurrentParams() {
    const currentParams = this.route.snapshot.queryParamMap;
    this.queryParams = { ...(currentParams as any)['params'] };
    
    const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(
      this.queryParams,
      this.tableData()
    );
    
    if (!this.queryParams['sortBy']) {
      updatedTableData.sortBy = '-datePosted';
    }
    
    this.tableData.set(updatedTableData);

    // Show advanced filters if any filter params are present
    const hasFilterParams = [...this.filtersList, ...this.dateFiltersList].some(key => this.queryParams[key]);
    if (hasFilterParams) {
      this.showAdvancedFilters.set(true);
    }

    // Build filters object from query params
    const filters: Record<string, string> = {};
    [...this.filtersList, ...this.dateFiltersList].forEach(filterKey => {
      if (this.queryParams[filterKey]) {
        filters[filterKey] = this.queryParams[filterKey];
      }
    });

    const secondarySort = updatedTableData.sortBy.includes('displayName') ? '' : '+displayName';

    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      this.queryParams['keywords'] || '',
      'Document',
      [{ 'name': 'project', 'value': this.projId }],
      updatedTableData.currentPage,
      updatedTableData.pageSize,
      updatedTableData.sortBy,
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.AMENDMENT, this.lists),
      false,
      secondarySort,
      filters
    ));
  }

  onMessageOut(msg: ITableMessage) {
    const params: Params = {};
    
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
    
    this.submit({ ...this.route.snapshot.queryParams, ...params });
  }

  private toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;
    if (currentSort?.includes(field)) {
      return (currentSort[0] === '+' ? '-' : '+') + field;
    }
    return '-' + field;
  }

  executeSearch(searchPackage: any) {
    const params: any = {
      keywords: searchPackage.keywords || null,
      sortBy: searchPackage.keywords && searchPackage.keywordsChanged ? '-score' : '-datePosted',
      currentPage: 1
    };

    const queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList, this.dateFiltersList);
    this.submit(params, queryFilters);
  }

  onToggleFiltersPanel(event: { showPanel: boolean }) {
    this.showAdvancedFilters.set(event.showPanel);
  }

  onResetControls() {
    if (this.tableData().sortBy.includes('score')) {
      this.submit({ sortBy: '-datePosted' });
    }
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
        this.milestoneArray,
        [],
        null,
        null,
        true
      ),
      6
    );

    const documentTypeFilter = new FilterObject(
      'type',
      FilterType.MultiSelect,
      'Document Type',
      new MultiSelectDefinition(
        this.documentTypeArray,
        [],
        null,
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
        this.projectPhaseArray,
        [],
        null,
        null,
        true
      ),
      4
    );

    this.filters.set([
      docDateFilter,
      milestoneFilter,
      documentTypeFilter,
      projectPhaseFilter
    ]);
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

  ngOnDestroy() {
    this.alive = false;
  }
}
