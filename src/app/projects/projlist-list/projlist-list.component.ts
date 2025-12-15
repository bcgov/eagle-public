import { Component, ElementRef, ChangeDetectionStrategy, input, output, signal, effect, untracked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Project } from 'app/models/project';
import { CommentPeriodService } from 'app/services/commentperiod.service';
import { ConfigService } from 'app/services/config.service';
import { VarDirective } from '../../shared/utils/ng-var.directive';

@Component({
  selector: 'app-projlist-list',
  templateUrl: './projlist-list.component.html',
  styleUrl: './projlist-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, VarDirective],
  standalone: true
})
export class ProjlistListComponent {
  // NB: this component is bound to the same list of apps as the other components
  projects = input<Array<Project>>([]); // from projects component
  setCurrentApp = output<Project>(); // to projects component
  unsetCurrentApp = output<Project>(); // to projects component

  public commentPeriodService = inject(CommentPeriodService); // used in template
  public configService = inject(ConfigService);
  private elementRef = inject(ElementRef);

  private currentApp: Project | null = null; // for selecting app in list
  public loading = signal<boolean>(false);
  private numToLoad = signal<number>(0);

  get clientWidth(): number {
    return this.elementRef.nativeElement.firstElementChild?.clientWidth ?? 0;
  }

  constructor() {
    // Watch for project changes using effect
    let isFirstRun = true;
    effect(() => {
      const currentProjects = this.projects();
      if (isFirstRun || currentProjects.length === 0) {
        isFirstRun = false;
        return;
      }

      untracked(() => {
        // Clear current selection if the selected app is no longer in the list
        if (this.currentApp && !currentProjects.some(p => p._id === this.currentApp?._id)) {
          this.currentApp = null;
        }
        
        this.numToLoad.set(this.configService.listPageSize);
        this.setLoaded();
      });
    });
  }

  public isCurrentApp(item: Project): boolean {
    return item === this.currentApp;
  }

  public toggleCurrentApp(item: Project): void {
    if (this.isCurrentApp(item)) {
      this.currentApp = null;
      this.unsetCurrentApp.emit(item);
    } else {
      this.currentApp = item;
      this.setCurrentApp.emit(item);
    }
  }

  public loadedApps(): Project[] {
    return this.projects().filter(a => a.isLoaded);
  }

  public appsWithShapes(): Project[] {
    return this.projects().filter(a => a.centroid?.length === 2);
  }

  public onLoadStart() { this.loading.set(true); }

  public onLoadEnd() { this.loading.set(false); }

  public loadMore() {
    this.numToLoad.update(n => n + this.configService.listPageSize);
    this.setLoaded();
  }

  private setLoaded() {
    // set first 'n' apps as 'loaded'
    const projects = this.projects();
    const limit = this.numToLoad();
    for (let i = 0; i < projects.length; i++) {
      projects[i].isLoaded = (i < limit);
    }
  }
}
