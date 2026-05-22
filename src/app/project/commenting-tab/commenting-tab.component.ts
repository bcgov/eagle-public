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

  public readonly project = this.storageService.currentProject;
  public readonly commentPeriods = signal<CommentPeriod[]>([]);
  public readonly loading = signal(true);
  private readonly destroy$ = new Subject<void>();
  private loadedProjectId: string | null = null;
  private commentPeriodSub: Subscription | null = null;

  constructor() {
    effect(() => {
      const projectId = this.project()?._id;
      if (projectId && projectId !== this.loadedProjectId) {
        this.loadedProjectId = projectId;
        this.getCommentPeriods(projectId);
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
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res.data) {
            const periods = res.data.map((element: CommentPeriod) => {
              const fullText = element.instructions
                ? element.instructions.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                : '';
              const match = fullText.match(/Comment Period on the (.*?) for /);
              return {
                ...element,
                instructions: match ? match[1] : '',
                additionalText: element.additionalText || fullText || element.informationLabel,
              };
            });
            this.commentPeriods.set(periods);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
