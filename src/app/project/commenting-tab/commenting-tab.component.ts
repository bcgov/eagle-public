import { Component, inject, ChangeDetectionStrategy, effect, signal, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CommentPeriodService } from '../../services/commentperiod.service';
import { CommentPeriod } from '../../models/commentperiod';
import { StorageService } from '../../services/storage.service';
import { EngageApiService, EngageEngagement } from '../../services/engage-api.service';

@Component({
  selector: 'app-commenting-tab',
  imports: [DatePipe],
  templateUrl: './commenting-tab.component.html',
  styleUrls: ['./commenting-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommentingTabComponent {
  private router = inject(Router);
  private storageService = inject(StorageService);
  public commentPeriodService = inject(CommentPeriodService);
  private destroyRef = inject(DestroyRef);
  private engageApi = inject(EngageApiService);

  public readonly project = this.storageService.currentProject;
  public readonly commentPeriods = signal<CommentPeriod[]>([]);
  public readonly engageData = signal<Map<string, EngageEngagement>>(new Map());
  public readonly loading = signal(true);
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

  engagementStatus(eng: EngageEngagement): 'Open' | 'Closed' | 'Upcoming' | null {
    if (!eng.start_date || !eng.end_date) return null;
    const now = new Date();
    const parseDate = (s: string) =>
      s.includes('T') || s.includes(' ') ? new Date(s) : new Date(s + 'T23:59:59');
    if (now < parseDate(eng.start_date)) return 'Upcoming';
    if (now > parseDate(eng.end_date)) return 'Closed';
    return 'Open';
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
      .pipe(takeUntilDestroyed(this.destroyRef))
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
            this.fetchEngageData(deduped);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private fetchEngageData(periods: CommentPeriod[]) {
    const met = periods.filter(cp => cp.isMet && cp.metURL);
    if (!met.length) return;

    forkJoin(met.map(cp =>
      this.engageApi.getEngagementByUrl(cp.metURL!).pipe(catchError(() => of(null)))
    ))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => {
        const map = new Map<string, EngageEngagement>();
        met.forEach((cp, i) => { if (results[i]) map.set(cp._id, results[i]!); });
        this.engageData.set(map);
      });
  }

}
