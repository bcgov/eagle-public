import { Component, ElementRef, ChangeDetectionStrategy, input, output, signal, computed, effect, untracked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Project } from 'app/models/project';
import { CommentPeriodService } from 'app/services/commentperiod.service';
import { ConfigService } from 'app/services/config.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { VarDirective } from '../../shared/utils/ng-var.directive';

@Component({
  selector: 'app-projlist-list',
  templateUrl: './projlist-list.component.html',
  styleUrl: './projlist-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, VarDirective],
})
export class ProjlistListComponent {
  // NB: this component is bound to the same list of apps as the other components
  projects = input<Project[] | null>(null); // from projects component
  setCurrentApp = output<Project>(); // to projects component
  unsetCurrentApp = output<Project>(); // to projects component

  public commentPeriodService = inject(CommentPeriodService); // used in template
  public configService = inject(ConfigService);
  private elementRef = inject(ElementRef);
  private loadingState = inject(LoadingStateService);

  private currentApp: Project | null = null; // for selecting app in list
  public loading = this.loadingState.isLoading;
  private numToLoad = signal<number>(0);

  // Computed signal for loaded projects (no mutation)
  public loadedApps = computed(() => {
    const projects = this.projects();
    if (projects === null) return [];
    const limit = this.numToLoad();
    return projects.slice(0, limit);
  });

  // Computed signal for projects with valid coordinates
  public appsWithShapes = computed(() => {
    return (this.projects() ?? []).filter(a => a.centroid?.length === 2);
  });

  get clientWidth(): number {
    return this.elementRef.nativeElement.firstElementChild?.clientWidth ?? 0;
  }

  constructor() {
    // Initialize with first page of results
    effect(() => {
      const currentProjects = this.projects();
      if (currentProjects === null) return;

      untracked(() => {
        // Clear current selection if the selected app is no longer in the list
        if (this.currentApp && !currentProjects.some(p => p._id === this.currentApp?._id)) {
          this.currentApp = null;
        }

        // Initialize page size if not set
        if (this.numToLoad() === 0 && currentProjects.length > 0) {
          this.numToLoad.set(this.configService.listPageSize);
        }
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

  public loadMore() {
    this.numToLoad.update(n => n + this.configService.listPageSize);
  }
}
