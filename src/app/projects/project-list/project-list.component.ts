import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';

import { Org } from 'app/models/organization';
import { Project } from 'app/models/project';
import { SearchTerms } from 'app/models/search';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { Constants } from 'app/shared/utils/constants';
import { FilterObject } from 'app/shared/components/table-template/filter-object';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';

import { OrgService } from 'app/services/org.service';
import { SearchService } from 'app/services/search.service';
import { StorageService } from 'app/services/storage.service';
import { ConfigService } from 'app/services/config.service';

class ProjectFilterObject {
  constructor(
    public type: object = {},
    public eacDecision: object = {},
    public decisionDateStart: object = {},
    public decisionDateEnd: object = {},
    public pcp: object = {},
    public proponent: Array<Org> = [],
    public region: Array<string> = [],
    public CEAAInvolvement: Array<string> = [],
    public projectPhase: Array<string> = [],
    public vc: Array<object> = []
  ) { }
}

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss']
})
export class ProjectListComponent implements OnInit, OnDestroy {
  public readonly constants = Constants;
  public projects: Array<Project> = [];
  public loading = true;

  public tableParams: TableParamsObject = new TableParamsObject();
  public terms = new SearchTerms();

  public filterForAPI: object = {};

  public filterForUI: ProjectFilterObject = new ProjectFilterObject();

  public projectTableData: TableObject;
  public projectTableColumns: any[] = [
    {
      name: 'Name',
      value: 'name',
      width: 'col-2'
    },
    {
      name: 'Proponent',
      value: 'proponent.name',
      width: 'col-2'
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2'
    },
    {
      name: 'Region',
      value: 'region',
      width: 'col-2'
    },
    {
      name: 'Phase',
      value: 'currentPhaseName',
      width: 'col-2'
    },
    {
      name: 'Decision',
      value: 'eacDecision',
      width: 'col-2'
    }
  ];

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public filters: FilterObject[] = [];

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  private projectTypeFilter = new FilterObject('type', 'Project Type', null, Constants.PROJECT_TYPE_COLLECTION, [], null);
  private eaDecisionDateFilter = new FilterObject('eacDecision', 'EA Decision', { startDateId: 'decisionDateStart', endDateId: 'decisionDateEnd' }, [], [], this.legislationFilterGroup);
  private pcpFilter = new FilterObject('pcp', 'Public Comment Period', null, Constants.PCP_COLLECTION, [], null);
  // the filterObjects below will get added to a "more filters" collection
  private proponentFilter = new FilterObject('proponent', 'Proponent', null, [], [], null);
  private regionFilter = new FilterObject('region', 'Region', null, Constants.REGIONS_COLLECTION, [], null);
  private iaacFilter = new FilterObject('CEAAInvolvement', 'IAAC Involvement', null, [], [], this.legislationFilterGroup);
  private phaseFilter = new FilterObject('projectPhase', 'Project Phase', null, [], [], this.legislationFilterGroup);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplateUtils,
    private storageService: StorageService,
    private searchService: SearchService,
    private orgService: OrgService,
    private config: ConfigService,
    private _changeDetectionRef: ChangeDetectorRef
  ) {
       // prebake for table
       this.projectTableData = new TableObject(
        ProjectListTableRowsComponent,
        [],
        this.tableParams
      );

      // inject filters into table template
      this.filters.push(this.projectTypeFilter);
      this.filters.push(this.eaDecisionDateFilter);
      this.filters.push(this.pcpFilter);

      // Add the "More filters" collection to filters, then add the filters
      // you want in the collection to the filterCollections 'collection' attribute
      let filterCollection = new FilterObject('moreFilters', 'More Filters...');
      filterCollection.collection = [this.proponentFilter,
                                     this.regionFilter,
                                     this.iaacFilter,
                                     this.phaseFilter];

      this.filters.push(filterCollection);
  }

  ngOnInit() {
    // Fetch proponents
    this.orgService
      .getByCompanyType('Proponent/Certificate Holder')
      .switchMap((res: any) => {
        if (res) {
          this.proponentFilter.options = res || [];
          return this.config.lists;
        } else {
          alert('Uh-oh, couldn\'t load proponents');
          this.router.navigate(['/']);
        }
      })
      .switchMap((list: any) => {
        list.map(item => {
          switch (item.type) {
            case 'eaDecisions':
              this.eaDecisionDateFilter.options.push({ ...item });
              break;
            case 'ceaaInvolvements':
              this.iaacFilter.options.push({ ...item });
              break;
            case 'projectPhase':
              this.phaseFilter.options.push({ ...item});
              break;
          }
        });

        return this.route.params;
      })
      .switchMap((res: any) => {
        let params = { ...res };
        // default sort for project list is alphabetical
        params.sortBy = '+name'

        this.tableParams = this.tableTemplateUtils.getParamsFromUrl(
          params,
          this.filterForAPI,
          '+name'
        );

        // check if the filters are in session state, for handling
        // retaining the filters when a user clicks back from a project
        // into the project list
        if (this.storageService && this.storageService.state.projList) {
          this.tableParams = this.storageService.state.projList.tableParams;
          this.filterForAPI = this.storageService.state.projList.filterForAPI;
          this.filterForUI = this.storageService.state.projList.filterForUI;
        }

        this.router.url.split(';').forEach(filterVal => {
          if (filterVal.split('=').length === 2) {
            let filterName = filterVal.split('=')[0];
            let val = filterVal.split('=')[1];
            if (val && val !== 'null' && val.length !== 0) {
              if (!['currentPage', 'pageSize', 'sortBy', 'ms', 'keywords'].includes(filterName)) {
                this.filterForAPI[filterName] = val;
              }
            }
          }
        });

        if (this.filterForAPI && this.filterForAPI.hasOwnProperty('projectPhase')) {
          this.filterForAPI['currentPhaseName'] = this.filterForAPI['projectPhase'];
          delete this.filterForAPI['projectPhase'];
        }

        return this.searchService
          .getSearchResults(
            this.tableParams.keywords,
            'Project',
            [],
            this.tableParams.currentPage,
            this.tableParams.pageSize,
            this.tableParams.sortBy,
            {},
            true,
            null,
            this.filterForAPI,
            ''
          );
      })
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {

        if (this.filterForAPI && this.filterForAPI.hasOwnProperty('currentPhaseName')) {
          this.filterForAPI['projectPhase'] = this.filterForAPI['currentPhaseName'];
          delete this.filterForAPI['currentPhaseName'];
        }

        if (res[0].data) {
          if (res[0].data.searchResults.length > 0) {
            this.tableParams.totalListItems =
              res[0].data.meta[0].searchResultsTotal;
            this.projects = res[0].data.searchResults;
          } else {
            this.tableParams.totalListItems = 0;
            this.projects = [];
          }
          this.setRowData();
        } else {
          alert('Uh-oh, couldn\'t load search results');
          // results not found --> navigate back to search
          this.router.navigate(['/']);
        }
        this.loading = false;
        this._changeDetectionRef.detectChanges();
      });

  }

  addProject() {
    this.storageService.state.back = {
      url: ['/projects'],
      label: 'All Projects(s)'
    };
    this.router.navigate(['/projects', 'add']);
  }

  setRowData() {
    let projectList = [];
    if (this.projects && this.projects.length > 0) {
      this.projects.forEach(project => {
        projectList.push({
          _id: project._id,
          name: project.name,
          proponent: project.proponent,
          type: project.type,
          region: project.region,
          currentPhaseName: project.currentPhaseName,
          eacDecision: project.eacDecision
        });
      });
    }
    this.projectTableData = new TableObject(
      ProjectListTableRowsComponent,
      projectList,
      this.tableParams
    );
  }

  executeSearch(apiFilters) {
    this.terms.keywords = apiFilters.keywords;
    this.tableParams.keywords = apiFilters.keywords;
    this.filterForAPI = apiFilters.filterForAPI;

    // build filterForUI/URL from the new filterForAPI object
    this.filterForUI = new ProjectFilterObject(this.filterForAPI['type']               ? this.filterForAPI['type'].split(',')            : null,
                                               this.filterForAPI['eacDecision']        ? this.filterForAPI['eacDecision'].split(',')     : null,
                                               this.filterForAPI['decisionDateStart'],
                                               this.filterForAPI['decisionDateEnd'],
                                               this.filterForAPI['pcp']                ? this.filterForAPI['pcp'].split(',')             : null,
                                               this.filterForAPI['proponent']          ? this.filterForAPI['proponent'].split(',')       : null,
                                               this.filterForAPI['region']             ? this.filterForAPI['region'].split(',')          : null,
                                               this.filterForAPI['CEAAInvolvement']    ? this.filterForAPI['CEAAInvolvement'].split(',') : null,
                                               this.filterForAPI['projectPhase']       ? this.filterForAPI['projectPhase'].split(',')    : null,
                                               null);

    this.getPaginatedProjects(this.tableParams.currentPage);
  }

  getPaginatedProjects(pageNumber) {
    this.tableParams = this.tableTemplateUtils.updateTableParams(
      this.tableParams,
      pageNumber,
      this.tableParams.sortBy
    );

    // store the table params in the event of a page navigation
    this.storageService.state.projList = {};
    this.storageService.state.projList.filterForAPI = this.filterForAPI;
    this.storageService.state.projList.filterForUI = this.filterForUI;
    this.storageService.state.projList.tableParams = this.tableParams;

    if (this.filterForAPI.hasOwnProperty('projectPhase')) {
      this.filterForAPI['currentPhaseName'] = this.filterForAPI['projectPhase'];
      delete this.filterForAPI['projectPhase'];
    }

    this.searchService
      .getSearchResults(
        this.tableParams.keywords,
        'Project',
        null,
        pageNumber,
        this.tableParams.pageSize,
        this.tableParams.sortBy,
        {},
        true,
        null,
        this.filterForAPI,
        '',
        true
      )
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res && res[0].data) {
          this.tableParams.totalListItems = res[0].data.searchResults.length > 0
                                          ? res[0].data.meta[0].searchResultsTotal
                                          : 0;
          this.projects = res[0].data.searchResults;
          this.tableTemplateUtils.updateUrl(
            this.tableParams.sortBy,
            this.tableParams.currentPage,
            this.tableParams.pageSize,
            this.filterForAPI,
            this.tableParams.keywords
          );
          this.setRowData();
          this._changeDetectionRef.detectChanges();
        } else {
          alert('Uh-oh, couldn\'t load projects');
          // project not found --> navigate back to search
          this.router.navigate(['/']);
        }
      });

      if (this.filterForAPI.hasOwnProperty('currentPhaseName')) {
        this.filterForAPI['projectPhase'] = this.filterForAPI['currentPhaseName'];
        delete this.filterForAPI['currentPhaseName'];
      }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
