import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ConfigService } from 'app/services/config.service';
import { FavoriteService } from 'app/services/favorite.service';
import { TableService } from 'app/services/table.service';
import {
  CheckOrRadioFilterDefinition,
  DateFilterDefinition,
  FilterObject,
  FilterType,
  MultiSelectDefinition,
  OptionItem,
} from 'app/shared/components/search-filter-template/filter-object';
import {
  IColumnObject,
  TableObject2,
} from 'app/shared/components/table-template-2/table-object-2';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { Constants } from 'app/shared/utils/constants';
import { takeWhile } from 'rxjs/operators';
import { DocSearchTableRowsComponent } from './search-documents-table-rows/search-document-table-rows.component';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit, OnDestroy {
  private tableId = 'search';
  private lists: any[] = [];

  public queryParams: Params;

  public loadingLists = true;
  public loadingTableParams = true;
  public loadingTableData = true;

  public tableColumns: IColumnObject[] = [
    {
      name: 'Document Name',
      value: 'displayName',
      width: 'col-4',
    },
    {
      name: 'Project',
      value: 'project.name',
      width: 'col-2',
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-2',
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2',
    },
    {
      name: 'Milestone',
      value: 'milestone',
      width: 'col-2',
    },
    {
      name: 'Download',
      value: '',
      width: 'col-1',
      nosort: true,
    },
    {
      name: 'Favorite',
      value: '',
      width: 'col-1',
      nosort: true,
    },
  ];

  public filters: FilterObject[] = [];

  private legislationFilterGroup = {
    name: 'legislation',
    labelPrefix: null,
    labelPostfix: ' Act Terms',
  };

  public tableData: TableObject2 = new TableObject2({
    component: DocSearchTableRowsComponent,
  });

  private alive = true;

  private milestoneArray = [];
  private documentAuthorTypeArray = [];
  private documentTypeArray = [];
  private projectPhaseArray = [];
  public showAdvancedFilters = false;
  private filtersList = [
    'milestone',
    'documentAuthorType',
    'type',
    'projectPhase',
    'changedInLast30days',
    'favoritesOnly'
  ];
  private dateFiltersList = ['datePostedStart', 'datePostedEnd'];
  private initialLoad = true;

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private tableTemplateUtils: TableTemplate,
    private tableService: TableService,
    private configService: ConfigService,
    public favoriteService: FavoriteService,
  ) {}

  ngOnInit() {
    this.configService.lists
      .pipe(takeWhile(() => this.alive))
      .subscribe((list) => {
        this.lists = list;
        this.lists.forEach((item) => {
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
        this.loadingLists = false;
        this._changeDetectionRef.detectChanges();
      });

    this.route.queryParamMap
      .pipe(takeWhile(() => this.alive))
      .subscribe((data) => {
        this.queryParams = { ...data['params'] };
        // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
        this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(
          data['params'],
          this.tableData
        );

        if (
          this.initialLoad &&
          (this.queryParams['milestone'] ||
            this.queryParams['documentAuthorType'] ||
            this.queryParams['type'] ||
            this.queryParams['datePostedStart'] ||
            this.queryParams['datePostedEnd'] ||
            this.queryParams['projectPhase'])
        ) {
          this.showAdvancedFilters = true;
          this.initialLoad = false;
        }

        this.loadingTableParams = false;
        this._changeDetectionRef.detectChanges();
      });

    this.tableService
      .getValue(this.tableId)
      .pipe(takeWhile(() => this.alive))
      .subscribe((searchResults: SearchResults) => {
        if (searchResults.data !== 0) {
          this.tableData.totalListItems = searchResults.totalSearchCount;
          this.tableData.items = searchResults.data.map((record) => {
            return { rowData: record };
          });
          this.onUpdateFavorites();

          this.tableData.columns = this.tableColumns;
          this.tableData.options.showAllPicker = true;

          this.loadingTableData = false;

          this._changeDetectionRef.detectChanges();
          let seachInput = document.getElementById('search-input');
          if (seachInput !== null) {
            seachInput.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest',
            });
            seachInput = null;
          }
        }
      });
  }

  private setFilters() {
    const docDateFilter = new FilterObject(
      'issuedDate',
      FilterType.DateRange,
      '', // if you include a name, it will add a label to the date range filter.
      new DateFilterDefinition(
        'datePostedStart',
        'Start Date',
        'datePostedEnd',
        'End Date'
      ),
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

    const changeInLast30daysFilter = new FilterObject(
      'changedInLast30days',
      FilterType.Checkbox,
      'Changed In Last 30 Days',
      new CheckOrRadioFilterDefinition([
        new OptionItem('changedInLast30days', 'Changed In Last 30 Days'),
      ])
    );

    const favoritesOnlyFilter = new FilterObject(
      'favoritesOnly',
      FilterType.Checkbox,
      'Favorites Only',
      new CheckOrRadioFilterDefinition([
        new OptionItem('favoritesOnly', 'Favorites Only'),
      ])
    );

    this.filters = [
      docDateFilter,
      milestoneFilter,
      documentAuthorTypeFilter,
      documentTypeFilter,
      projectPhaseFilter,
      changeInLast30daysFilter,
      favoritesOnlyFilter,
    ];
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage) {

    let params = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.tableService.data[this.tableId].cachedConfig.keywords =
        params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.tableService.data[this.tableId].cachedConfig.sortBy =
          params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = Constants.tableDefaults.DEFAULT_SORT_BY;
      this.tableService.data[this.tableId].cachedConfig.keywords = '';
      this.tableService.data[this.tableId].cachedConfig.sortBy =
        params['sortBy'];
    }

    params['currentPage'] = 1;
    this.tableService.data[this.tableId].cachedConfig.currentPage =
      params['currentPage'];

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage,
      this.filtersList,
      this.dateFiltersList
    );
    this.tableService.data[this.tableId].cachedConfig.filters = queryFilters;

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params = {};
    switch (msg.label) {
      case 'columnSort':
        if (this.tableData.sortBy.charAt(0) === '+') {
          params['sortBy'] = '-' + msg.data;
        } else {
          params['sortBy'] = '+' + msg.data;
        }
        this.tableService.data[this.tableId].cachedConfig.sortBy =
          params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage =
          params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loadingTableData = true;
        }
        params['currentPage'] = 1;
        this.tableService.data[this.tableId].cachedConfig.pageSize =
          params['pageSize'];
        this.tableService.data[this.tableId].cachedConfig.currentPage =
          params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params, filters = null) {
    this.router.navigate([], {
      queryParams: filters ? { ...params, ...filters } : params,
      relativeTo: this.route,
      queryParamsHandling: 'merge',
    });
    this.loadingTableData = true;
    this.tableService.refreshData(this.tableId);
  }

  ngOnDestroy() {
    this.alive = false;
  }

  onUpdateFavorites() {
    this.favoriteService.fetchData([{name: 'type', value: 'Document'}, {name: 'fields[]', value: ['_id']}], null, 1000);
  }
}
