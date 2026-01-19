import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project } from '../../models/project';
import { CommentPeriodService } from '../../services/commentperiod.service';

@Component({
  selector: 'app-proj-detail-popup',
  templateUrl: './proj-detail-popup.component.html',
  styleUrls: ['./proj-detail-popup.component.css'],
  imports: [RouterLink],
  standalone: true
})
export class ProjDetailPopupComponent implements OnInit, OnDestroy {
  proj!: Project;
  commentPeriodStatus = signal<string>('');

  private destroy$ = new Subject<void>();
  private commentPeriodService = inject(CommentPeriodService);

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
}
