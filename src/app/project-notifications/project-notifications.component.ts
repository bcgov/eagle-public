import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Constants } from 'app/shared/utils/constants';
import 'rxjs/add/operator/takeUntil';
import { Subject } from 'rxjs/Subject';
import * as _ from 'lodash';
import { ProjectNotification } from 'app/models/projectNotification';
import { SearchTerms } from 'app/models/search';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { SearchService } from 'app/services/search.service';
import { ApiService } from 'app/services/api';
import { MatSnackBar } from '@angular/material';
import { CommentPeriodService } from 'app/services/commentperiod.service';

class ProjectNotificationFilterObject {
  constructor(
    public type: object = {},
    public pcp: object = {},
    public region: Array<string> = [],
    public decision: object = {}
  ) { }
}

@Component({
  selector: 'app-project-notifications',
  templateUrl: './project-notifications.component.html',
  styleUrls: ['./project-notifications.component.scss']
})

export class ProjectNotificationsListComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public regions: Array<object> = [];
  public decisions: Array<object> = [];
  public commentPeriods: Array<object> = [];
  public projectTypes: Array<object> = [];
  public loading = true;
  public tableData: TableObject;
  public tableParams: TableParamsObject = new TableParamsObject();
  public terms = new SearchTerms();
  public showAdvancedSearch = true;
  public filterForURL: object = {};
  public filterForAPI: object = {};
  public filterForUI: ProjectNotificationFilterObject = new ProjectNotificationFilterObject();

  public projectNotifications: Array<ProjectNotification> = [];
  public readonly constants = Constants;

  public showFilters: object = {
    type: false,
    region: false,
    pcp: false,
    decision: false
  };

  public numFilters: object = {
    type: 0,
    region: 0,
    pcp: 0,
    decision: 0
  };

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private tableTemplateUtils: TableTemplateUtils,
    private searchService: SearchService,
    private api: ApiService,
    public snackBar: MatSnackBar,
    private commentPeriodService: CommentPeriodService
  ) {

    this.regions = Constants.REGIONS_COLLECTION;
    this.commentPeriods = Constants.PCP_COLLECTION;
    this.projectTypes = Constants.PROJECT_TYPE_COLLECTION;
    this.decisions = Constants.PROJECT_NOTIFICATION_DECISIONS;
  }

  ngOnInit() {
    this.route.params
      .takeUntil(this.ngUnsubscribe)
      .subscribe(params => {
        this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params);
        if (this.tableParams.sortBy === '-datePosted') {
          this.tableParams.sortBy = '-startDate';
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, null, this.tableParams.keywords);
        }
        this._changeDetectionRef.detectChanges();

        this.route.data
          .takeUntil(this.ngUnsubscribe)
          .subscribe((res: any) => {
            if (res.projectNotifications[0].data) {
              if (res.projectNotifications[0].data.searchResults.length > 0) {
                this.tableParams.totalListItems = res.projectNotifications[0].data.meta[0].searchResultsTotal;
                this.projectNotifications = res.projectNotifications[0].data.searchResults;

                // load projetNotification comment periods and document refs
                this.projectNotifications.forEach(projectNotification => {
                  projectNotification['commentPeriod'] = null;
                  this.getProjectCommentPeriod(projectNotification);
                  this.getProjectDocuments(projectNotification);
                });

              } else {
                this.tableParams.totalListItems = 0;
                this.projectNotifications = [];
              }

              this.loading = false;
              this._changeDetectionRef.detectChanges();
            } else {
              alert('Uh-oh, couldn\'t load notification projects');
              // activity not found --> navigate back to search
              this.router.navigate(['/']);
            }
          });
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  toggleFilter(name) {
    if (this.showFilters[name]) {
      this.updateCount(name);
      this.showFilters[name] = false;
    } else {
      Object.keys(this.showFilters).forEach(key => {
        if (this.showFilters[key]) {
          this.updateCount(key);
          this.showFilters[key] = false;
        }
      });
      this.showFilters[name] = true;
    }
  }

  isShowingFilter() {
    return Object.keys(this.showFilters).some(key => {
      return this.showFilters[key];
    });
  }

  clearSelectedItem(filter: string, item: any) {
    this.filterForUI[filter] = this.filterForUI[filter].filter(option => option._id !== item._id);
  }

  getProjectDocuments(project: ProjectNotification) {
    this.searchService.getSearchResults(
      null,
      'Document',
      [],
      1,
      1000,
      null,
      { documentSource: 'PROJECT-NOTIFICATION', project: project._id })
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res[0] && res[0].data && res[0].data.searchResults) {
          project.documents = res[0].data.searchResults;
          this._changeDetectionRef.detectChanges();
        }
      });
  }
  getProjectCommentPeriod(project: ProjectNotification) {
    this.commentPeriodService.getAllByProjectId(project._id)
    .takeUntil(this.ngUnsubscribe)
    .subscribe((res: any) => {
      if (res && res.data) {
        res.data.forEach(cp => {
          if (!project['commentPeriod'] || (project['commentPeriod'] && cp.daysRemainingCount > project['commentPeriod'].daysRemainingCount)) {
            project['commentPeriod'] = cp;
            this._changeDetectionRef.detectChanges();
          }
        });
      }
    });
  }

  clearAll() {
    Object.keys(this.filterForUI).forEach(key => {
      if (this.filterForUI[key]) {
        if (Array.isArray(this.filterForUI[key])) {
          this.filterForUI[key] = [];
        } else if (typeof this.filterForUI[key] === 'object') {
          this.filterForUI[key] = {};
        } else {
          this.filterForUI[key] = '';
        }
      }
    });
    this.updateCounts();
  }

  updateCount(name) {
    const getCount = n => {
      return Object.keys(this.filterForUI[n]).filter(
        k => this.filterForUI[n][k]
      ).length;
    };

    this.numFilters[name] = getCount(name);
  }

  updateCounts() {
    this.updateCount('type');
    this.updateCount('region');
    this.updateCount('pcp');
    this.updateCount('decision');
  }

  public onSubmit() {
    let params = this.terms.getParams();

    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.tableParams.currentPage;
    params['sortBy'] = this.tableParams.sortBy = '-score';
    params['keywords'] = this.tableParams.keywords;
    params['pageSize'] = this.tableParams.pageSize

    this.setParamsFromFilters(params);

    this.router.navigate(['project-notifications', params]);
  }

  setParamsFromFilters(params) {
    this.collectionFilterToParams(params, 'type', 'name');
    this.collectionFilterToParams(params, 'pcp', 'code');
    this.collectionFilterToParams(params, 'region', 'code');
    this.collectionFilterToParams(params, 'decision', 'code');
  }

  collectionFilterToParams(params, name, identifyBy) {
    if (this.filterForUI[name].length) {
      const values = this.filterForUI[name].map(record => {
        return record[identifyBy];
      });
      params[name] = values.join(',');
    }
  }

  downloadDocuments(project) {
    project.documents.forEach(doc => {
      this.api.downloadDocument(doc)
      .then(() => {
         // Turn this into a toast
         this.snackBar.open('Downloading document');
         window.setTimeout(() => this.snackBar.dismiss(), 2000)
       })
       .catch(() => {
         this.snackBar.open('Error opening document! Please try again later');
         window.setTimeout(() => this.snackBar.dismiss(), 2000)
       })
     });
  }
  search() {

    let params = this.terms.getParams();

    params['ms'] = new Date().getMilliseconds();

    this.setParamsFromFilters(params);

    let queryConditions = {};

    if (params.type) {
      queryConditions['type'] = params.type;
    }

    if (params.region) {
      queryConditions['region'] = params.region;
    }

    if (params.pcp) {
      queryConditions['pcp'] = params.pcp;
    }

    if (params.decision) {
      queryConditions['decision'] = params.decision;
    }

    this.searchService.getSearchResults(
      this.tableParams.keywords,
      'ProjectNotification',
      null,
      1,
      10000,
      '-_id',
      queryConditions
    )
    .takeUntil(this.ngUnsubscribe)
    .subscribe((res: any) => {
      this.tableParams.totalListItems = 0;
      this.projectNotifications = [];

      if (res[0] && res[0].data && res[0].data.searchResults.length > 0) {
        this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
        this.projectNotifications = res[0].data.searchResults;

        // load projetNotification comment periods and document refs
        this.projectNotifications.forEach(projectNotification => {
          projectNotification['commentPeriod'] = null;
          this.getProjectCommentPeriod(projectNotification);
          this.getProjectDocuments(projectNotification);
        });
      }

      this.loading = false;
      this._changeDetectionRef.detectChanges();
    });
  }
}
