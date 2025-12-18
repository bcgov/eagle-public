import { Component, OnInit, OnDestroy, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { takeWhile } from 'rxjs/operators';
import { SearchResults } from '../../models/search';
import { SearchParamObject } from '../../services/search.service';
import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';
import { Constants } from '../../shared/utils/constants';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { ConfigService } from '../../services/config.service';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  styleUrls: ['./documents-tab.component.css'],
  imports: [TableTemplateComponent, SearchFilterTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocumentsTabComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableTemplateUtils = inject(TableTemplate);
  private readonly tableService = inject(TableService);
  private readonly configService = inject(ConfigService);

  private readonly tableId = 'documentsTab';
  private readonly tableSignal = this.tableService.getTableSignal(this.tableId);
  private alive = true;
  private lists: any[] = [];
  private initialLoad = true;
  private projId = '';

  private readonly milestoneArray: any[] = [];
  private readonly documentAuthorTypeArray: any[] = [];
  private readonly documentTypeArray: any[] = [];
  private readonly projectPhaseArray: any[] = [];
  private readonly filtersList = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
  private readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];

  public queryParams: Params = {};
  public readonly loadingLists = signal(true);
  public readonly loadingTableParams = signal(true);
  public readonly loadingTableData = signal(true);
  public readonly showAdvancedFilters = signal(false);
  public readonly filters = signal<FilterObject[]>([]);
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));

  public readonly tableColumns: IColumnObject[] = [
    {
      name: '★',
      value: 'isFeatured',
      width: 'col-1'
    },
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-3'
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

  private readonly legislationFilterGroup = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };

  constructor() {
    // Watch for table data changes from service
    effect(() => {
      const searchResults = this.tableSignal();
      
      if (searchResults && searchResults.data && searchResults.data !== 0) {
        const currentTableData = this.tableData();
        currentTableData.totalListItems = searchResults.totalSearchCount;
        currentTableData.items = searchResults.data.map((record: any) => {
          record['showFeatured'] = true;
          return { rowData: record };
        });
        currentTableData.columns = this.tableColumns;
        currentTableData.options.showAllPicker = true;

        this.tableData.set(currentTableData);
        this.loadingTableData.set(false);
      }
    });
  }

  ngOnInit() {
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists = list;
      this.lists.forEach(item => {
        if (item.type === 'label') {
          this.milestoneArray.push({ ...item });
        } else if (item.type === 'author') {
          this.documentAuthorTypeArray.push({ ...item });
        } else if (item.type === 'doctype') {
          this.documentTypeArray.push({ ...item });
        } else if (item.type === 'projectPhase') {
          this.projectPhaseArray.push({ ...item });
        }
      });
      this.setFilters();
      this.loadingLists.set(false);
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...(data as any)['params'] };
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams((data as any)['params'], this.tableData());
      this.tableData.set(updatedTableData);

      if (
        this.initialLoad && (
          this.queryParams['milestone'] ||
          this.queryParams['documentAuthorType'] ||
          this.queryParams['type'] ||
          this.queryParams['datePostedStart'] ||
          this.queryParams['datePostedEnd'] ||
          this.queryParams['projectPhase'])
      ) {
        this.showAdvancedFilters.set(true);
        this.initialLoad = false;
      }

      this.loadingTableParams.set(false);

      // Build filters object from query params
      const filters: Record<string, string> = {};
      this.filtersList.forEach(filterKey => {
        if (this.queryParams[filterKey]) {
          filters[filterKey] = this.queryParams[filterKey];
        }
      });
      this.dateFiltersList.forEach(filterKey => {
        if (this.queryParams[filterKey]) {
          filters[filterKey] = this.queryParams[filterKey];
        }
      });
      
      // Fetch data with current params
      const currentTableData = this.tableData();
      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        this.queryParams['keywords'] || '',
        'Document',
        [],
        currentTableData.currentPage,
        currentTableData.pageSize,
        currentTableData.sortBy,
        { project: this.projId },
        true,
        currentTableData.sortBy.includes('displayName') ? '' : '+displayName',
        filters
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
        this.milestoneArray,
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
        this.documentAuthorTypeArray,
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
        this.documentTypeArray,
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
        this.projectPhaseArray,
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
        if (currentTableData.sortBy.charAt(0) === '+') {
          params['sortBy'] = '-' + msg.data;
        } else {
          params['sortBy'] = '+' + msg.data;
        }
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === currentTableData.totalListItems) {
          this.loadingTableData.set(true);
        }
        params['currentPage'] = 1;
        break;
    }
    this.submit(params);
  }

  submit(params: any, filters: any = null) {
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.loadingTableData.set(true);
  }

  onToggleFiltersPanel(event: { showPanel: boolean }) {
    this.showAdvancedFilters.set(event.showPanel);
  }

  onResetControls() {
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
