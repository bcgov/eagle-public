import { Component, inject, signal, input, effect, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Project } from '../../models/project';
import { CommentPeriodService } from '../../services/commentperiod.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';

@Component({
  selector: 'app-proj-detail-popup',
  templateUrl: './proj-detail-popup.component.html',
  styleUrls: ['./proj-detail-popup.component.css'],
})
export class ProjDetailPopupComponent {
  proj = input.required<Project>();
  commentPeriodStatus = signal<string>('');

  private projId$ = new Subject<string>();
  private destroyRef = inject(DestroyRef);
  private commentPeriodService = inject(CommentPeriodService);
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  constructor() {
    // debounceTime(0) collapses any synchronous burst of emissions (e.g. from
    // rapid signal invalidations during marker batch operations) into a single
    // emission per event-loop tick, so at most one HTTP request fires.
    // switchMap then cancels any previous in-flight request if the project changes.
    // This is critical because the popup component is reused (never destroyed
    // between marker clicks), so takeUntil(destroy$) alone is not enough.
    this.projId$.pipe(
      debounceTime(0),
      switchMap(projId => {
        this.commentPeriodStatus.set('');
        return this.commentPeriodService.getAllByProjectId(projId);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: any) => {
        if (data && data.length > 0 && data[0]?.commentPeriodStatus) {
          this.commentPeriodStatus.set(data[0].commentPeriodStatus);
        }
      },
      error: (err) => {
        console.error('Error loading comment period:', err);
      }
    });

    effect(() => {
      const project = this.proj();
      if (project?._id) {
        this.projId$.next(project._id);
      }
    });
  }

  navigateToProject(): void {
    const project = this.proj();
    if (project?._id) {
      this.analytics.track('Project Viewed', {
        project_id: project._id,
        project_name: project.name,
        source: 'map_popup'
      });
      this.router.navigate(['/p', project._id]);
    }
  }
}
