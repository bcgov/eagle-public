import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { tap, take, filter } from 'rxjs/operators';
import { Project } from '../models/project';
import { ProjectService } from './project.service';
import { LoggingService } from './logging.service';
import { LoadingStateService } from './loading-state.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
    private currentState: any;
    private projectService = inject(ProjectService);
    private logger = inject(LoggingService);
    private loadingState = inject(LoadingStateService);
    
    // Project cache signals
    private cachedProjects = signal<Project[]>([]);
    private isPreloading = this.loadingState.getOperationState('storage-preload');
    private preloadComplete = signal(false);
    private preloadComplete$ = new Subject<Project[]>();

    constructor() {
        this.currentState = {};
    }

    get state(): any { return this.currentState; }
    set state(state: any) { this.currentState[state.type] = state.data; }

    /**
     * Start preloading projects in the background
     */
    preloadProjects(): void {
        if (this.isPreloading() || this.preloadComplete()) {
            return;
        }

        this.loadingState.startLoading('storage-preload', 'Preloading projects');
        
        // Get count first to know how many projects to load
        this.projectService.getCount()
            .pipe(
                tap(count => {
                    this.logger.info(`Preloading ${count} projects in background...`, 'StorageService');
                })
            )
            .subscribe({
                next: (count) => {
                    // Load all projects in one batch
                    this.projectService.getAllFull(1, count)
                        .pipe(
                            tap(projects => {
                                // Initialize isMatches property for each project
                                const projectsWithMatches = projects.map(p => ({ ...p, isMatches: true }));
                                this.cachedProjects.set(projectsWithMatches);
                                this.preloadComplete.set(true);
                                this.loadingState.stopLoading('storage-preload');
                                this.logger.info(`Preloaded ${projects.length} projects successfully`, 'StorageService');
                                this.preloadComplete$.next(projectsWithMatches);
                                this.preloadComplete$.complete();
                            })
                        )
                        .subscribe({
                            error: (error) => {
                                this.logger.error('Error preloading projects', 'StorageService', error);
                                this.loadingState.stopLoading('storage-preload');
                                this.preloadComplete$.error(error);
                            }
                        });
                },
                error: (error) => {
                    this.logger.error('Error getting project count', 'StorageService', error);
                    this.loadingState.stopLoading('storage-preload');
                }
            });
    }

    /**
     * Get cached projects if available, otherwise return null
     */
    getCachedProjects(): Project[] | null {
        return this.preloadComplete() ? this.cachedProjects() : null;
    }

    /**
     * Get an Observable that emits cached projects when available
     * - Immediately emits if already cached
     * - Waits for preload to complete if in progress
     * - Returns empty if no preload in progress
     */
    getCachedProjects$(): Observable<Project[] | null> {
        // If already cached, return immediately
        if (this.preloadComplete()) {
            return of(this.cachedProjects());
        }
        
        // If preload is in progress, wait for it
        if (this.isPreloading()) {
            return this.preloadComplete$.pipe(take(1));
        }
        
        // No cache and no preload in progress
        return of(null);
    }

    /**
     * Manually cache projects (e.g., after loading in ProjectsComponent)
     */
    cacheProjects(projects: Project[]): void {
        this.cachedProjects.set(projects);
        this.preloadComplete.set(true);
        this.logger.info(`Cached ${projects.length} projects`, 'StorageService');
    }

    /**
     * Check if projects are cached and ready
     */
    isCacheReady(): boolean {
        return this.preloadComplete();
    }

    /**
     * Check if currently preloading
     */
    isPreloadingProjects(): boolean {
        return this.isPreloading();
    }

    /**
     * Clear the project cache
     */
    clearProjectCache(): void {
        this.cachedProjects.set([]);
        this.preloadComplete.set(false);
    }
}
