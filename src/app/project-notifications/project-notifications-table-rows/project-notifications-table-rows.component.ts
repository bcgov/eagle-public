import { BreakpointObserver, Breakpoints, MediaMatcher } from '@angular/cdk/layout';
import { Component, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectionStrategy, inject, signal, EventEmitter } from '@angular/core';
import { takeWhile } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';

import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { ProjectNotificationDocumentsTableDetailsComponent } from '../project-notification-documents-table-details/project-notification-documents-table-details.component';
import { ProjectNotificationDocumentsTableComponent } from '../project-notification-documents-table/project-notification-documents-table.component';

@Component({
  selector: 'tr[app-project-notifications-table-rows]',
  templateUrl: './project-notifications-table-rows.component.html',
  styleUrls: ['./project-notifications-table-rows.component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTabsModule,
    ProjectNotificationDocumentsTableDetailsComponent,
    ProjectNotificationDocumentsTableComponent
  ]
})
export class ProjectNotificationsTableRowsComponent implements TableRowComponent, OnInit, OnDestroy {
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
  
  private breakpointObserver = inject(BreakpointObserver);
  private mediaMatcher = inject(MediaMatcher);

  isMobile = signal(false);
  private alive = true;

  ngOnInit() {
    const mediaQueryList = this.mediaMatcher.matchMedia(Breakpoints.Web);
    this.isMobile.set(!mediaQueryList.matches);

    this.breakpointObserver.observe([Breakpoints.Tablet])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          this.isMobile.set(true);
        }
      });

    this.breakpointObserver.observe([Breakpoints.Web])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          this.isMobile.set(false);
        }
      });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
