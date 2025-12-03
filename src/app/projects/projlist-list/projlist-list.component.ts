import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter, SimpleChanges, ElementRef } from '@angular/core';

import { Project } from 'app/models/project';
import { CommentPeriodService } from 'app/services/commentperiod.service';
import { ConfigService } from 'app/services/config.service';

@Component({
  selector: 'app-projlist-list',
  templateUrl: './projlist-list.component.html',
  styleUrls: ['./projlist-list.component.scss']
})

export class ProjlistListComponent implements OnInit, OnChanges, OnDestroy {
  // NB: this component is bound to the same list of apps as the other components
  @Input() projects: Array<Project> = []; // from projects component
  @Output() setCurrentApp = new EventEmitter(); // to projects component
  @Output() unsetCurrentApp = new EventEmitter(); // to projects component

  private currentApp: Project = null; // for selecting app in list
  public loading = false;
  private numToLoad = 0;

  constructor(
    public commentPeriodService: CommentPeriodService, // used in template
    public configService: ConfigService,
    private elementRef: ElementRef
  ) { }

  get clientWidth(): number {
    return this.elementRef.nativeElement.firstElementChild.clientWidth; // div.app-list__container
  }

  public ngOnInit() { }

  // called when apps list changes
  public ngOnChanges(changes: SimpleChanges) {
    if (changes.projects && !changes.projects.firstChange && changes.projects.currentValue) {
      // console.log('list: got visible apps from map component');
      // console.log('# visible apps =', this.projects.length);

      this.numToLoad = this.configService.listPageSize; // init/reset
      this.setLoaded();
    }
  }

  public ngOnDestroy() { }

  private isCurrentApp(item: Project): boolean {
    return (item === this.currentApp);
  }

  public toggleCurrentApp(item: Project) {
    const index = this.projects.findIndex(p => p._id === item._id);
    if (index >= 0) {
      if (!this.isCurrentApp(item)) {
        this.currentApp = item; // set
        this.setCurrentApp.emit(item);
      } else {
        this.currentApp = null; // unset
        this.unsetCurrentApp.emit(item);
      }
    }
  }

  public loadedApps(): Array<Project> {
    return this.projects.filter(a => a.isLoaded);
  }

  public appsWithShapes(): Array<Project> {
    return this.projects.filter(a => a.centroid.length === 2);
  }

  public onLoadStart() { this.loading = true; }

  public onLoadEnd() { this.loading = false; }

  public loadMore() {
    this.numToLoad += this.configService.listPageSize;
    this.setLoaded();
  }

  private setLoaded() {
    // set first 'n' apps as 'loaded'
    for (let i = 0; i < this.projects.length; i++) {
      this.projects[i].isLoaded = (i < this.numToLoad);
    }
  }
}
