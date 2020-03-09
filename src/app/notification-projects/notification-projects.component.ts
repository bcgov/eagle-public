import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Constants } from 'app/shared/utils/constants';
import 'rxjs/add/operator/takeUntil';
import { Subject } from 'rxjs/Subject';
import * as _ from 'lodash';
import { ProjectNotification } from 'app/models/projectNotification';
import { News } from 'app/models/news';
import { SearchTerms } from 'app/models/search';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';

import { NotificationProjectsListTableRowsComponent } from './notification-projects-list-table-rows/notification-projects-list-table-rows.component';
import { Project } from 'app/models/project';

class ProjectNotificationFilterObject {
  constructor(
    public type: object = {},
    public eacDecision: object = {},
    public decisionDateStart: object = {},
    public decisionDateEnd: object = {},
    public pcp: object = {},
    public region: Array<string> = [],
    public CEAAInvolvement: Array<string> = [],
    public projectPhase: Array<string> = [],
    public vc: Array<object> = []
  ) { }
}

@Component({
  selector: 'app-notification-projects',
  templateUrl: './notification-projects.component.html',
  styleUrls: ['./notification-projects.component.scss']
})

export class NotificationProjectsListComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public loading = true;
  public notificationProjects: Array<News> = [];
  public tableData: TableObject;
  public tableParams: TableParamsObject = new TableParamsObject();
  public terms = new SearchTerms();
  public showAdvancedSearch = true;
  public filterForURL: object = {};
  public filterForAPI: object = {};
  public filterForUI: ProjectNotificationFilterObject = new ProjectNotificationFilterObject();

  public projectNotifications: Array<ProjectNotification> = [];

  public showFilters: object = {
    type: false,
    eacDecision: false,
    pcp: false,
    more: false
  };

  public numFilters: object = {
    type: 0,
    eacDecision: 0,
    pcp: 0,
    more: 0
  };

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private tableTemplateUtils: TableTemplateUtils
  ) {
    let mock1 = new ProjectNotification();
    mock1._id = '123';
    mock1.name = 'Project Notification 123';
    mock1.type = 'Mine';
    mock1.subType = 'Placer';
    mock1.nature = 'New Construction';
    mock1.region = 'Central';
    mock1.location = 'Somewhere in the middle';
    mock1.decision = 'No';
    mock1.decisionDate = new Date();
    mock1.description = 'Building a pretty sweet mine, probably going to dig stuff up.';
    mock1.longitude = '-123';
    mock1.latitude = '47';
    mock1.trigger = 'Greenhouse Gas';

    let mock2 = new ProjectNotification();
    mock2._id = 'abc';
    mock2.name = 'Another cool Project Notification';
    mock2.type = 'Mine';
    mock2.subType = 'Waste Plutonium Dump';
    mock2.nature = 'Bulldozing over sunny acres free-range orphanage';
    mock2.region = 'Central';
    mock2.location = 'As close to your house as possible';
    mock2.decision = 'Absolutely';
    mock2.decisionDate = new Date();
    mock2.description = 'Massive ecological catastrophe';
    mock2.longitude = '-123';
    mock2.latitude = '52';
    mock2.trigger = 'Large mutant rat-like monsters in the area';

    this.projectNotifications.push(mock1);
    this.projectNotifications.push(mock2);
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
            if (res.notificationProjects[0].data) {
              if (res.notificationProjects[0].data.searchResults.length > 0) {
                this.tableParams.totalListItems = res.notificationProjects[0].data.meta[0].searchResultsTotal;
                this.notificationProjects = res.notificationProjects[0].data.searchResults;
              } else {
                this.tableParams.totalListItems = 0;
                this.notificationProjects = [];
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
    if (this.notificationProjects && this.notificationProjects.length > 0) {
      this.tableData = new TableObject(
        NotificationProjectsListTableRowsComponent,
        this.notificationProjects,
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

  updateCount(name) {
    const getCount = n => {
      return Object.keys(this.filterForUI[n]).filter(
        k => this.filterForUI[n][k]
      ).length;
    };

    let num = 0;
    if (name === 'more') {
      num =
        getCount('region') +
        // this.filterForUI.proponent.length +
        getCount('CEAAInvolvement') +
        this.filterForUI.vc.length;
    } else {
      num = getCount(name);
      if (name === 'eacDecision') {
        // num += this.isNGBDate(this.filterForUI.decisionDateStart) ? 1 : 0;
        // num += this.isNGBDate(this.filterForUI.decisionDateEnd) ? 1 : 0;
      }
    }
    this.numFilters[name] = num;
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
}
