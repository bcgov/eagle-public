import { Component, OnDestroy, inject, ChangeDetectionStrategy, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CommentPeriodService } from '../../services/commentperiod.service';
import { CommentPeriod } from '../../models/commentperiod';
import { LoadingStateService } from '../../services/loading-state.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-commenting-tab',
  imports: [CommonModule],
  templateUrl: './commenting-tab.component.html',
  styleUrls: ['./commenting-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class CommentingTabComponent implements OnDestroy {
  private router = inject(Router);
  private storageService = inject(StorageService);
  public commentPeriodService = inject(CommentPeriodService);
  public loadingState = inject(LoadingStateService);

  // Use the reactive signal from storageService
  public project = this.storageService.currentProject;
  public commentPeriods = signal<CommentPeriod[] | null>(null);
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private loadedProjectId: string | null = null;

  // Computed loading state based on null-sentinel
  public loading = computed(() => this.commentPeriods() === null);

  constructor() {
    // Load comment periods when project is available
    effect(() => {
      const project = this.project();
      if (project?._id && project._id !== this.loadedProjectId) {
        this.loadedProjectId = project._id;
        this.commentPeriods.set(null); // Show loading skeleton
        this.getCommentPeriods(project._id);
      }
    });
  }

  goToCP(commentPeriod: CommentPeriod) {
    const project = this.project();
    if (commentPeriod.isMet && commentPeriod.metURL) {
      window.open(commentPeriod.metURL, '_blank');
    } else if (project?._id) {
      this.router.navigate(['p', project._id, 'cp', commentPeriod._id]);
    }
  }

  getCommentPeriods(projectId: string) {
    this.commentPeriodService.getAllByProjectId(projectId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (res: any) => {
          if (res && res.data) {
            const periods = res.data.map((element: CommentPeriod) => {
              const fullText = element.instructions
                ? element.instructions.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                : '';
              const match = fullText.match(/Comment Period on the (.*?) for /);
              element.instructions = match ? match[1] : '';
              element.additionalText = element.additionalText || fullText || element.informationLabel;
              return element;
            });
            const seenIds = new Set<string>();
            const seenUrls = new Set<string>();
            const deduped = periods.filter((p: CommentPeriod) => {
              if (seenIds.has(p._id)) return false;
              seenIds.add(p._id);
              if (p.isMet && p.metURL) {
                if (seenUrls.has(p.metURL)) return false;
                seenUrls.add(p.metURL);
              }
              return true;
            });
            this.commentPeriods.set(deduped);
          } else {
            this.commentPeriods.set([]);
          }
        },
        error: () => {
          this.commentPeriods.set([]);
        }
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
