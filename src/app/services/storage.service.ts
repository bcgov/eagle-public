import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Project } from '../models/project';
import { ProjectService } from './project.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
    private currentState: any;
    private projectService = inject(ProjectService);
    
    // Project cache signals
    private cachedProjects = signal<Project[]>([]);
    private isPreloading = signal(false);
    private preloadComplete = signal(false);

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

        this.isPreloading.set(true);
        
        // Get count first to know how many projects to load
        this.projectService.getCount()
            .pipe(
                tap(count => {
                    console.log(`Preloading ${count} projects in background...`);
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
                                this.isPreloading.set(false);
                                console.log(`Preloaded ${projects.length} projects successfully`);
                            })
                        )
                        .subscribe({
                            error: (error) => {
                                console.error('Error preloading projects:', error);
                                this.isPreloading.set(false);
                            }
                        });
                },
                error: (error) => {
                    console.error('Error getting project count:', error);
                    this.isPreloading.set(false);
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
