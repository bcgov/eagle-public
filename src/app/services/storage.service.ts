import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { tap, take } from 'rxjs/operators';
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
    
    // Current project signal for reactive access
    public currentProject = signal<Project | null>(null);

    constructor() {
        this.currentState = {};
    }

    get state(): any { return this.currentState; }
    set state(state: any) { 
        this.currentState[state.type] = state.data;
        if (state.type === 'currentProject') {
            this.currentProject.set(state.data);
        }
    }

    /**
     * Start preloading projects in the background
     */
    preloadProjects(): void {
        if (this.isPreloading() || this.preloadComplete()) {
            return;
        }

        this.loadingState.startLoading('storage-preload', 'Preloading projects');
        this.logger.info('Preloading projects in background...', 'StorageService');
        
        this.projectService.getAllFull(1, 1000000)
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
    }

    /**
     * Get an Observable that emits cached projects when available
     * - Immediately emits if already cached
     * - Waits for preload to complete if in progress
     * - Returns null if no cache and no preload in progress
     */
    getCachedProjects$(): Observable<Project[] | null> {
        if (this.preloadComplete()) {
            return of(this.cachedProjects());
        }
        
        if (this.isPreloading()) {
            return this.preloadComplete$.pipe(take(1));
        }
        
        return of(null);
    }

    /**
     * Cache projects after loading
     */
    cacheProjects(projects: Project[]): void {
        this.cachedProjects.set(projects);
        this.preloadComplete.set(true);
        this.logger.info(`Cached ${projects.length} projects`, 'StorageService');
    }
}
