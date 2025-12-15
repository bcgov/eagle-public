import { Component, OnInit, OnDestroy, Renderer2, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, Observable, concat } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import * as L from 'leaflet';

import { Project } from 'app/models/project';
import { ProjectService } from 'app/services/project.service';
import { ConfigService } from 'app/services/config.service';
import { StorageService } from 'app/services/storage.service';
import { ProjlistFiltersComponent } from './projlist-filters/projlist-filters.component';
import { ProjlistListComponent } from './projlist-list/projlist-list.component';
import { ProjlistMapComponent } from './projlist-map/projlist-map.component';

const PAGE_SIZE = 100;

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css'],
  imports: [
    CommonModule,
    MatSnackBarModule,
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

  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  public configService = inject(ConfigService);
  private renderer = inject(Renderer2);
  private storageService = inject(StorageService);

  private snackBarRef: MatSnackBarRef<SimpleSnackBar> | null = null;
  private isLoading = signal<boolean>(false);
  
  // Project data signals
  public allApps = signal<Project[]>([]);
  public filterApps = signal<Project[]>([]);
  public mapApps = computed(() => this.filterApps().filter(a => a.isMatches === true));
  public listApps = computed(() => this.mapApps().filter(a => a.isVisible));
  
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

    // Check if projects are already cached
    const cachedProjects = this.storageService.getCachedProjects();
    
    if (cachedProjects && cachedProjects.length > 0) {
      // Use cached projects immediately
      console.log(`Using ${cachedProjects.length} cached projects`);
      this.allApps.set(cachedProjects);
      this.filterApps.set(this.allApps());
    } else {
      // Load projects normally if not cached
      this.getApps();
    }
  }

  private getApps() {
    const start = Date.now();
    this.setLoadingState(true);
    this.allApps.set([]);

    this.projectService.getCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (count) => {
          const totalPages = Math.ceil(count / PAGE_SIZE);
          const observables: Observable<Project[]>[] = Array.from(
            { length: totalPages },
            (_, i) => this.projectService.getAllFull(i + 1, PAGE_SIZE)
          );

          concat(...observables)
            .pipe(
              takeUntil(this.destroy$),
              finalize(() => {
                this.setLoadingState(false);
                console.log(`Loaded ${this.allApps().length} projects in ${Date.now() - start}ms`);
                // Apply filters after all projects are loaded
                this.filterApps.set(this.allApps());
              })
            )
            .subscribe({
              next: (projects: Project[]) => {
                // Initialize projects with isMatches = true so they show initially
                projects.forEach(p => {
                  if (p.isMatches === undefined) p.isMatches = true;
                });
                this.allApps.update(apps => [...apps, ...projects]);
                // Don't update filterApps here - wait until all projects are loaded
              },
              error: (error) => {
                console.error('Error loading projects:', error);
                this.snackBar.open('Failed to load projects', 'Dismiss', { duration: 5000 });
                this.router.navigate(['/']);
              }
            });
        },
        error: (error) => {
          console.error('Error counting projects:', error);
          this.snackBar.open('Failed to count projects', 'Dismiss', { duration: 5000 });
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
   * Event handler called when filters component updates list of matching apps.
   */
  public updateMatching() {
    // Trigger computed signal recalculation by creating new array reference
    // This is necessary because computed signals don't detect object property mutations
    this.filterApps.set([...this.filterApps()]);
    this.appmap.resetMap();
  }

  /**
   * Event handler called when map component updates list of visible apps.
   */
  public updateVisible() {
    // The map component mutates isVisible on project objects.
    // The listApps computed signal will automatically reflect these changes
    // when the list component accesses it. No action needed here.
  }

  /**
   * Event handler called when map component reset button is clicked.
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
    this.destroy$.next();
    this.destroy$.complete();
  }
}
