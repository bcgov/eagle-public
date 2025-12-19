import { Component, OnInit, OnDestroy, Renderer2, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import * as L from 'leaflet';

import { Project } from 'app/models/project';
import { ProjectService } from 'app/services/project.service';
import { ConfigService } from 'app/services/config.service';
import { StorageService } from 'app/services/storage.service';
import { ProjectFilterService } from 'app/services/project-filter.service';
import { MapStateService } from 'app/services/map-state.service';
import { FilterStateService } from 'app/services/filter-state.service';
import { LoggingService } from 'app/services/logging.service';
import { ProjlistFiltersComponent } from './projlist-filters/projlist-filters.component';
import { ProjlistListComponent } from './projlist-list/projlist-list.component';
import { ProjlistMapComponent } from './projlist-map/projlist-map.component';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css'],
  imports: [
    CommonModule,
    ProjlistFiltersComponent,
    ProjlistListComponent,
    ProjlistMapComponent
  ],
  standalone: true
})
export class ProjectsComponent implements OnInit, OnDestroy {
  @ViewChild('appmap', { static: true }) appmap!: ProjlistMapComponent;
  @ViewChild('applist', { static: true }) applist!: ProjlistListComponent;
  @ViewChild('appfilters', { static: true }) appfilters!: ProjlistFiltersComponent;

  private router = inject(Router);
  private projectService = inject(ProjectService);
  public configService = inject(ConfigService);
  private renderer = inject(Renderer2);
  private storageService = inject(StorageService);
  private filterService = inject(ProjectFilterService);
  private filterStateService = inject(FilterStateService);
  private mapStateService = inject(MapStateService);
  private logger = inject(LoggingService);

  private isLoading = signal<boolean>(false);
  
  // Project data signals - immutable state management
  public allApps = signal<Project[]>([]);
  
  // Filtered projects (matches filter criteria)
  public filterApps = computed(() => this.filterService.filterProjects(this.allApps()));
  
  // Projects visible on map (matches filters AND in map bounds)
  public mapApps = computed(() => this.filterApps());
  
  // Projects visible in list (visible on map)
  public listApps = computed(() => {
    const filtered = this.filterApps();
    const bounds = this.mapStateService.currentBounds();
    
    if (!bounds) {
      return filtered;
    }
    
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
  }

  ngOnInit() {
    // prevent underlying map actions for list and filters components
    const applist_list = <HTMLElement>document.getElementById('applist-list');
    if (applist_list) {
      L.DomEvent.disableClickPropagation(applist_list);
      L.DomEvent.disableScrollPropagation(applist_list);
    }

    const applist_filters = <HTMLElement>document.getElementById('applist-filters');
    if (applist_filters) {
      L.DomEvent.disableClickPropagation(applist_filters);
      L.DomEvent.disableScrollPropagation(applist_filters);
    }

    // Show loading state while waiting for projects
    this.setLoadingState(true);

    // Wait for StorageService preload (started in app.ts), then use cache or fallback to direct load
    // Expected HTTP calls on first load:
    // 1. HEAD /api/public/project - get project count for preload
    // 2. GET /api/public/search?dataset=Project - preload all projects
    // 3. GET /api/public/search?dataset=List - load metadata (regions, types, etc.) for filters
    this.storageService.getCachedProjects$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cachedProjects) => {
          if (cachedProjects && cachedProjects.length > 0) {
            // Use cached projects (from preload or previous load)
            this.logger.info(`Using ${cachedProjects.length} cached projects`, 'ProjectsComponent');
            this.allApps.set(cachedProjects);
            this.setLoadingState(false);
          } else {
            // No cache available and no preload in progress - load projects
            this.getApps();
          }
        },
        error: () => {
          // Preload failed, load projects normally
          this.getApps();
        }
      });
  }

  private getApps() {
    const start = Date.now();
    this.setLoadingState(true);

    this.projectService.getCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (count) => {
          // Load all projects in a single optimized batch
          this.projectService.getAllFull(1, count)
            .pipe(
              takeUntil(this.destroy$),
              finalize(() => {
                this.setLoadingState(false);
                this.logger.info(`Loaded ${this.allApps().length} projects in ${Date.now() - start}ms`, 'ProjectsComponent');
              })
            )
            .subscribe({
              next: (projects: Project[]) => {
                this.allApps.set(projects);
                
                // Cache projects for future use
                this.storageService.cacheProjects(projects);
              },
              error: (error) => {
                this.logger.error('Error loading projects', 'ProjectsComponent', error);
                this.router.navigate(['/']);
              }
            });
        },
        error: (error) => {
          this.logger.error('Error counting projects', 'ProjectsComponent', error);
          this.router.navigate(['/']);
          this.setLoadingState(false);
        }
      });
  }

  private setLoadingState(loading: boolean) {
    this.isLoading.set(loading);
    if (loading) {
      this.appfilters.onLoadStart();
      this.appmap.onLoadStart();
      this.applist.onLoadStart();
    } else {
      this.appfilters.onLoadEnd();
      this.appmap.onLoadEnd();
      this.applist.onLoadEnd();
    }
  }



  /**
   * Reload all projects from the server
   */
  public reloadApps() {
    this.getApps();
  }

  /**
   * Event handler called when list component selects or unselects an app.
   */
  public highlightProject(app: Project, show: boolean) {
    this.appmap.onHighlightProject(app, show);
  }

  /**
   * Called when list component visibility is toggled.
   */
  public toggleAppList() {
    this.configService.isApplistListVisible = !this.configService.isApplistListVisible;
  }

  ngOnDestroy() {
    // Don't clear filters - let them persist for better UX
    // Users expect their search/filters to remain when navigating back
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
