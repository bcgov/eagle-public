import { BreakpointObserver, Breakpoints, MediaMatcher } from '@angular/cdk/layout';
import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';

import { TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'tr[app-project-notifications-table-rows]',
  templateUrl: './project-notifications-table-rows.component.html',
  styleUrls: ['./project-notifications-table-rows.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ProjectNotificationsTableRowsComponent extends TableRowComponent implements OnInit, OnDestroy {
  public isMobile = false;
  private alive = true;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private mediaMatcher: MediaMatcher
  ) {
    super();
  }

  ngOnInit() {
    const mediaQueryList = this.mediaMatcher.matchMedia(Breakpoints.Web);
    this.isMobile = !mediaQueryList.matches;

    this.breakpointObserver.observe([
      Breakpoints.Tablet
    ])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          this.isMobile = true;
        }
      });
    this.breakpointObserver.observe([
      Breakpoints.Web
    ])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          this.isMobile = false;
        }
      });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
