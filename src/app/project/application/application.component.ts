import { Component, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { takeWhile, take, switchMap } from 'rxjs/operators';
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
  selector: 'app-application',
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.css'],
  imports: [TableTemplateComponent, SearchFilterTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ApplicationComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableTemplateUtils = inject(TableTemplate);
  private readonly tableService = inject(TableService);
  private readonly loadingState = inject(LoadingStateService);
  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);

  private readonly tableId = 'application';
  private alive = true;
  private projId = '';
  private lists: any[] = [];
  private initialLoad = true;

  private readonly milestoneArray: any[] = [];
  private readonly documentTypeArray: any[] = [];
  private readonly projectPhaseArray: any[] = [];
  private readonly filtersList = ['milestone', 'type', 'projectPhase'];
  private readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];

  public queryParams: Params = {};
  public readonly showAdvancedFilters = signal(false);
  public readonly filters = signal<FilterObject[]>([]);

  public readonly loading = this.loadingState.getOperationState('table-application');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));
  private readonly tableSignal$ = toObservable(this.tableService.getTableSignal(this.tableId));

  constructor() {
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.tableService.clearTable(this.tableId);

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
    // Wait for lists metadata before subscribing to query params.
    // This prevents a premature fetch with empty lists (wrong modifiers) followed
    // by a second fetch once lists arrive — the source of the pop-in.
    this.configService.lists.pipe(
      take(1),
      switchMap(list => {
        this.lists = list;
        list.forEach((item: any) => {
          if (item.type === 'label') {
            this.milestoneArray.push({ ...item });
          } else if (item.type === 'doctype') {
            this.documentTypeArray.push({ ...item });
          } else if (item.type === 'projectPhase') {
            this.projectPhaseArray.push({ ...item });
          }
        });
        this.setFilters();
        return this.route.queryParamMap;
      }),
      takeWhile(() => this.alive)
    ).subscribe(() => {
      this.fetchDataWithCurrentParams();
    });
  }

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

  executeSearch(searchPackage: any) {
    const params: any = {
      keywords: searchPackage.keywords || null,
      sortBy: searchPackage.keywords && searchPackage.keywordsChanged ? '-score' : '-datePosted',
      currentPage: 1
    };

    const queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList, this.dateFiltersList);
    this.submit(params, queryFilters);
  }

  private fetchDataWithCurrentParams() {
    const currentParams = this.route.snapshot.queryParamMap;
    this.queryParams = { ...(currentParams as any)['params'] };
    
    const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(
      this.queryParams,
      this.tableData()
    );
    
    // Set default sort if not provided
    if (!this.queryParams['sortBy']) {
      updatedTableData.sortBy = '-datePosted';
    }
    
    this.tableData.set(updatedTableData);

    if (
      this.initialLoad && (
        this.queryParams['milestone'] ||
        this.queryParams['type'] ||
        this.queryParams['datePostedStart'] ||
        this.queryParams['datePostedEnd'] ||
        this.queryParams['projectPhase'])
    ) {
      this.showAdvancedFilters.set(true);
      this.initialLoad = false;
    }

    // Determine secondary sort
    const secondarySort = updatedTableData.sortBy.includes('displayName') ? '' : '+displayName';

    // Build filters object from query params
    const filters: Record<string, string> = {};
    [...this.filtersList, ...this.dateFiltersList].forEach(filterKey => {
      if (this.queryParams[filterKey]) {
        filters[filterKey] = this.queryParams[filterKey];
      }
    });

    // Fetch data with current params
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      this.queryParams['keywords'] || '',
      'Document',
      [{ 'name': 'project', 'value': this.projId }],
      updatedTableData.currentPage,
      updatedTableData.pageSize,
      updatedTableData.sortBy,
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.APPLICATION, this.lists),
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
    
    // If we're sorting by the same field, toggle direction
    if (currentSort?.includes(field)) {
      return (currentSort?.[0] === '+' ? '-' : '+') + field;
    }
    
    // Default to descending for new field
    return '-' + field;
  }

  submit(params: any, filters: any = null) {
    this.router.navigate([], {
      queryParams: filters ? { ...params, ...filters } : params,
      relativeTo: this.route,
      queryParamsHandling: 'merge'
    });
  }

  onToggleFiltersPanel(event: { showPanel: boolean }) {
    this.showAdvancedFilters.set(event.showPanel);
  }

  onResetControls() {
    const params: any = {};
    [...this.filtersList, ...this.dateFiltersList].forEach(filter => {
      params[filter] = null;
    });
    params['keywords'] = null;
    params['currentPage'] = 1;
    params['sortBy'] = '-datePosted';
    this.submit(params);
  }

  private setFilters() {
    const legislationFilterGroup = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };

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
        legislationFilterGroup,
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
        legislationFilterGroup,
        null,
        true
      ),
      6
    );

    const projectPhaseFilter = new FilterObject(
      'projectPhase',
      FilterType.MultiSelect,
      'Project Phase',
      new MultiSelectDefinition(
        this.projectPhaseArray,
        [],
        legislationFilterGroup,
        null,
        true
      ),
      6
    );

    this.filters.set([
      docDateFilter,
      milestoneFilter,
      documentTypeFilter,
      projectPhaseFilter
    ]);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
