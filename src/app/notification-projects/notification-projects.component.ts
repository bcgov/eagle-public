import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import 'rxjs/add/operator/takeUntil';
import { Subject } from 'rxjs/Subject';
import * as _ from 'lodash';

import { News } from 'app/models/news';
import { SearchTerms } from 'app/models/search';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';

import { NotificationProjectsListTableRowsComponent } from './notification-projects-list-table-rows/notification-projects-list-table-rows.component';

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

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private tableTemplateUtils: TableTemplateUtils
  ) { }

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
}
