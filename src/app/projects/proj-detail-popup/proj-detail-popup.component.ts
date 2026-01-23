import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project } from '../../models/project';
import { CommentPeriodService } from '../../services/commentperiod.service';

@Component({
  selector: 'app-proj-detail-popup',
  templateUrl: './proj-detail-popup.component.html',
  styleUrls: ['./proj-detail-popup.component.css'],
  standalone: true
})
export class ProjDetailPopupComponent implements OnInit, OnDestroy {
  proj!: Project;
  commentPeriodStatus = signal<string>('');

  private destroy$ = new Subject<void>();
  private commentPeriodService = inject(CommentPeriodService);
  private router = inject(Router);

  ngOnInit() {
    if (!this.proj?._id) {
      return;
    }

    this.commentPeriodService.getAllByProjectId(this.proj._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          if (data && data.length > 0 && data[0]?.commentPeriodStatus) {
            this.commentPeriodStatus.set(data[0].commentPeriodStatus);
          }
        },
        error: (err) => {
          console.error('Error loading comment period:', err);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToProject(): void {
    if (this.proj?._id) {
      this.router.navigate(['/p', this.proj._id]);
    }
  }
}
