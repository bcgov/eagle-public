import { Component, OnInit, OnDestroy, Renderer2, ViewChild, inject, signal, computed } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
declare const L: any;

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
  private projectService = inject(ProjectService);
  public configService = inject(ConfigService);
  private renderer = inject(Renderer2);
  private storageService = inject(StorageService);
  private filterService = inject(ProjectFilterService);
  private filterStateService = inject(FilterStateService);
  private mapStateService = inject(MapStateService);
  private logger = inject(LoggingService);
  
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

    // Wait for StorageService preload, then use cache or fallback to direct load
    this.storageService.getCachedProjects$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cachedProjects) => {
          if (cachedProjects && cachedProjects.length > 0) {
            // Use cached projects (from preload or previous load)
            this.logger.info(`Using ${cachedProjects.length} cached projects`, 'ProjectsComponent');
            this.allApps.set(cachedProjects);
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

  private getApps(): void {
    const start = Date.now();

    this.projectService.getAllFull(1, 1000000)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.logger.info(`Loaded ${this.allApps().length} projects in ${Date.now() - start}ms`, 'ProjectsComponent');
        })
      )
      .subscribe({
        next: (projects: Project[]) => {
          this.allApps.set(projects);
          this.storageService.cacheProjects(projects);
        },
        error: (error) => {
          this.logger.error('Error loading projects', 'ProjectsComponent', error);
          this.router.navigate(['/']);
        }
      });
  }

  public toggleAppList(): void {
    this.configService.isApplistListVisible = !this.configService.isApplistListVisible;
  }

  ngOnDestroy(): void {
    // Clear filters and reset state when leaving the page
    this.filterStateService.clearAll();
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
