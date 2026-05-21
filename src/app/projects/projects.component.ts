import { Component, OnInit, OnDestroy, Renderer2, ViewChild, inject, signal, computed } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
declare const L: any;

import { Project } from 'app/models/project';
import { ConfigService } from 'app/services/config.service';
import { StorageService } from 'app/services/storage.service';
import { ProjectFilterService } from 'app/services/project-filter.service';
import { MapStateService } from 'app/services/map-state.service';
import { FilterStateService } from 'app/services/filter-state.service';
import { LoggingService } from 'app/services/logging.service';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { TypesenseService } from 'app/services/typesense.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { ProjlistFiltersComponent } from './projlist-filters/projlist-filters.component';
import { ProjlistListComponent } from './projlist-list/projlist-list.component';
import { ProjlistMapComponent } from './projlist-map/projlist-map.component';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css'],
  imports: [
    ProjlistFiltersComponent,
    ProjlistListComponent,
    ProjlistMapComponent
],
  standalone: true
})
export class ProjectsComponent implements OnInit, OnDestroy {
  @ViewChild('appmap', { static: true }) appmap!: ProjlistMapComponent;
  @ViewChild('applist', { static: true }) applist!: ProjlistListComponent;

  private router = inject(Router);
  public configService = inject(ConfigService);
  private renderer = inject(Renderer2);
  private storageService = inject(StorageService);
  private filterService = inject(ProjectFilterService);
  private filterStateService = inject(FilterStateService);
  private mapStateService = inject(MapStateService);
  private logger = inject(LoggingService);
  private analytics = inject(AnalyticsService);
  private typesenseService = inject(TypesenseService);
  private loadingState = inject(LoadingStateService);

  // null = not yet loaded; [] = loaded but empty; Project[] = loaded with results
  public allApps = signal<Project[] | null>(null);

  // Filtered projects — null while loading, Project[] once data arrives
  public filterApps = computed(() => {
    const apps = this.allApps();
    return apps === null ? null : this.filterService.filterProjects(apps);
  });

  // Projects visible on map — always an array (map renders empty markers while loading)
  public mapApps = computed(() => this.filterApps() ?? []);

  // Projects visible in list — null while loading so the list can distinguish
  // "not yet loaded" from "loaded but empty"
  public listApps = computed(() => {
    const filtered = this.filterApps();
    if (filtered === null) return null;
    const bounds = this.mapStateService.currentBounds();
    if (!bounds) return filtered;
    return filtered.filter(project => this.mapStateService.isProjectInBounds(project));
  });
  
  private destroy$ = new Subject<void>();

  constructor() {
    // Clean up body class on navigation
    this.router.events
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.renderer.removeClass(document.body, 'no-scroll');
        }
      });

    // Kick off data fetch immediately — no need to wait for the DOM (ngOnInit)
    this.getApps();
  }

  ngOnInit() {
    // Prevent underlying map actions for list and filter overlays
    const applist_list = document.getElementById('applist-list') as HTMLElement;
    if (applist_list) {
      L.DomEvent.disableClickPropagation(applist_list);
      L.DomEvent.disableScrollPropagation(applist_list);
    }

    const applist_filters = document.getElementById('applist-filters') as HTMLElement;
    if (applist_filters) {
      L.DomEvent.disableClickPropagation(applist_filters);
      L.DomEvent.disableScrollPropagation(applist_filters);
    }
  }

  private getApps(): void {
    const start = Date.now();
    const loadingId = 'projects-full-page-1';
    this.loadingState.startLoading(loadingId, 'Loading projects');
    const source$ = this.typesenseService.getAllProjects().pipe(
      finalize(() => this.loadingState.stopLoading(loadingId))
    );

    source$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.logger.info(`Loaded ${this.allApps()?.length ?? 0} projects in ${Date.now() - start}ms`, 'ProjectsComponent');
        })
      )
      .subscribe({
        next: (projects: Project[]) => {
          this.allApps.set(projects);
          this.storageService.cacheProjects(projects);
        },
        error: (error) => {
          // Set empty array (not null) so the list shows "No projects found" on error
          this.allApps.set([]);
          this.logger.error('Error loading projects', 'ProjectsComponent', error);
          this.router.navigate(['/']);
        }
      });
  }

  public toggleAppList(): void {
    this.configService.isApplistListVisible = !this.configService.isApplistListVisible;
    
    // Track projects view toggle
    this.analytics.track('Projects View Changed', {
      view: this.configService.isApplistListVisible ? 'list' : 'map',
      total_projects: this.allApps()?.length ?? 0,
      filtered_projects: this.filterApps()?.length ?? 0,
      list_projects: this.listApps()?.length ?? 0
    });
  }

  ngOnDestroy(): void {
    // Clear filters and reset state when leaving the page
    this.filterStateService.clearAll();
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
