import { Component, OnDestroy, inject, ChangeDetectionStrategy, effect, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CommentPeriodService } from '../../services/commentperiod.service';
import { CommentPeriod } from '../../models/commentperiod';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-commenting-tab',
  imports: [DatePipe],
  templateUrl: './commenting-tab.component.html',
  styleUrls: ['./commenting-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommentingTabComponent implements OnDestroy {
  private router = inject(Router);
  private storageService = inject(StorageService);
  public commentPeriodService = inject(CommentPeriodService);

  // Use the reactive signal from storageService
  public project = this.storageService.currentProject;
  public commentPeriods = signal<CommentPeriod[]>([]);
  public loading = signal(true);
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private loadedProjectId: string | null = null;
  private commentPeriodSub: Subscription | null = null;

  constructor() {
    // Load comment periods when project is available
    effect(() => {
      const project = this.project();
      if (project?._id && project._id !== this.loadedProjectId) {
        this.loadedProjectId = project._id;
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
    this.commentPeriodSub?.unsubscribe();
    this.loading.set(true);
    this.commentPeriodSub = this.commentPeriodService.getAllByProjectId(projectId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (res: any) => {
          if (res.data) {
            const periods = res.data.map((element: CommentPeriod) => {
              const match = element.instructions ? element.instructions.match(/Comment Period on the (.*?) for /) : null;
              return { ...element, instructions: match ? match[1] : '' };
            });
            this.commentPeriods.set(periods);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
