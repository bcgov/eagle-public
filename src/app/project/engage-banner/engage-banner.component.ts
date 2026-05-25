import { Component, ChangeDetectionStrategy, input, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs';
import { EngageApiService, EngageEngagement } from '../../services/engage-api.service';
import { LoggingService } from '../../services/logging.service';
import { DatePipe, LowerCasePipe } from '@angular/common';

@Component({
  selector: 'app-engage-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe],
  templateUrl: './engage-banner.component.html',
  styleUrl: './engage-banner.component.css',
})
export class EngageBannerComponent {
  private engageApi = inject(EngageApiService);
  private logger = inject(LoggingService);
  private destroyRef = inject(DestroyRef);

  engagementUrl = input.required<string>();

  engagement = signal<EngageEngagement | null>(null);
  loading = signal(true);
  error = signal(false);

  engagementStatus = computed(() => {
    const eng = this.engagement();
    if (!eng?.start_date || !eng?.end_date) return null;
    const now = new Date();
    if (now < new Date(eng.start_date)) return 'Upcoming';
    if (now > new Date(eng.end_date)) return 'Closed';
    return 'Open';
  });

  constructor() {
    toObservable(this.engagementUrl).pipe(
      filter(url => !!url),
      switchMap(url => this.engageApi.getEngagementByUrl(url)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => { this.engagement.set(data); this.loading.set(false); },
      error: (err) => {
        this.logger.error('Failed to load Engage banner', 'EngageBannerComponent', err);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
