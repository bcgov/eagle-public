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

import { ProjectNotificationsListTableRowsComponent } from './project-notifications-list-table-rows/project-notifications-list-table-rows.component';

class ProjectNotificationFilterObject {
  constructor(
    public type: object = {},
    public pcp: object = {},
    public region: Array<string> = []
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
    pcp: false
  };

  public numFilters: object = {
    type: 0,
    region: 0,
    pcp: 0
  };

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private tableTemplateUtils: TableTemplateUtils
  ) {

    this.regions = Constants.REGIONS_COLLECTION;
    this.commentPeriods = Constants.PCP_COLLECTION;
    this.projectTypes = Constants.PROJECT_TYPE_COLLECTION;
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
              } else {
                this.tableParams.totalListItems = 0;
                this.projectNotifications = [];

                // mock data for testing
                let mock1 = new ProjectNotification();
                mock1._id = '123';
                mock1.name = 'Project Notification 123';
                mock1.type = 'Mine';
                mock1.subType = 'Placer';
                mock1.nature = 'New Construction';
                mock1.region = 'Central';
                mock1.location = 'Somewhere in the middle';
                mock1.decision = 'In Progress';
                mock1.decisionDate = new Date();
                mock1.description = 'Building a pretty sweet mine, probably going to dig stuff up.';
                mock1.centroid = [47, -123];
                mock1.trigger = 'Greenhouse Gas';

                let mock2 = new ProjectNotification();
                mock2._id = 'abc';
                mock2.name = 'Another cool Project Notification';
                mock2.type = 'Mine';
                mock2.subType = 'Waste Plutonium Dump';
                mock2.nature = 'Bulldozing over sunny acres free-range orphanage';
                mock2.region = 'Central';
                mock2.location = 'As close to your house as possible';
                mock2.decision = 'Nuke the place';
                mock2.decisionDate = new Date();
                mock2.description = 'Massive ecological catastrophe';
                mock2.centroid = [47, -123];
                mock2.trigger = 'Large mutant rat-like monsters in the area';

                this.projectNotifications.push(mock1);
                this.projectNotifications.push(mock2);
              }

              this.setRowData();
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

  setRowData() {
    if (this.projectNotifications && this.projectNotifications.length > 0) {
      this.tableData = new TableObject(
        ProjectNotificationsListTableRowsComponent,
        this.projectNotifications,
        this.tableParams
      );
    }
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

  projectInProgressIndicator(project: ProjectNotification) {
    return project.decisionDate <= new Date() ? 'In Progress' : 'Complete';
  }

  getProjectCommentPeriod(project: ProjectNotification) {
    return { pcp: new Date(), active: true , _id: '5e1bfa955f6fe400218fc620'};
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
  }
}
