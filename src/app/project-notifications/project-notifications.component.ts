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
import { FilterObject } from 'app/shared/components/table-template/filter-object';
import { SearchService } from 'app/services/search.service';
import { ApiService } from 'app/services/api';
import { MatSnackBar } from '@angular/material';
import { CommentPeriodService } from 'app/services/commentperiod.service';

@Component({
  selector: 'app-project-notifications',
  templateUrl: './project-notifications.component.html',
  styleUrls: ['./project-notifications.component.scss']
})

export class ProjectNotificationsListComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public loading = true;
  public tableData: TableObject;
  public tableParams: TableParamsObject = new TableParamsObject();
  public terms = new SearchTerms();
  public showAdvancedSearch = true;
  public filterForAPI: object = {};

  public projectNotifications: Array<ProjectNotification> = [];
  public readonly constants = Constants;

  public filters: FilterObject[] = [];

  private typeFilter = new FilterObject('type', 'Project Type', null, Constants.PROJECT_TYPE_COLLECTION, []);
  private regionFilter = new FilterObject('region', 'Region', null, Constants.REGIONS_COLLECTION, []);
  private pcpFilter = new FilterObject('pcp', 'Public Comment Period', null, Constants.PCP_COLLECTION, []);
  private decisionFilter = new FilterObject('decision', 'Notification Decision', null, Constants.PROJECT_NOTIFICATION_DECISIONS, []);

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
    this.filters.push(this.typeFilter);
    this.filters.push(this.regionFilter);
    this.filters.push(this.pcpFilter);
    this.filters.push(this.decisionFilter);
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

  getTrigger(project) {
    return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
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

  executeSearch(apiFilters) {
    this.terms.keywords = apiFilters.keywords;
    this.tableParams.keywords = apiFilters.keywords;
    this.filterForAPI = apiFilters.filterForAPI;

    this.search();
  }

  search() {
    this.searchService.getSearchResults(
      this.tableParams.keywords,
      'ProjectNotification',
      null,
      1,
      10000,
      '-_id',
      this.filterForAPI
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
