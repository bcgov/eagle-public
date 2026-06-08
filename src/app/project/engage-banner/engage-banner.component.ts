import { Component, ChangeDetectionStrategy, input, signal, computed, inject, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EngageApiService, EngageEngagement, isEngagementPublished } from '../../services/engage-api.service';
import { LoggingService } from '../../services/logging.service';
import { DatePipe, LowerCasePipe } from '@angular/common';

/** Pacific timezone identifier — all BC engagement deadlines are Pacific. */
const PACIFIC_TZ = 'America/Vancouver';

@Component({
  selector: 'app-engage-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe],
  templateUrl: './engage-banner.component.html',
  styleUrl: './engage-banner.component.css',
})
export class EngageBannerComponent implements OnInit {
  private engageApi = inject(EngageApiService);
  private logger = inject(LoggingService);
  private destroyRef = inject(DestroyRef);

  engagementUrl = input.required<string>();

  engagement = signal<EngageEngagement | null>(null);
  loading = signal(true);
  error = signal(false);

  /** Whether the engagement is published and visible on Engage. */
  isPublished = computed(() => {
    const eng = this.engagement();
    return eng ? isEngagementPublished(eng) : false;
  });

  engagementStatus = computed(() => {
    const eng = this.engagement();
    if (!eng?.start_date || !eng?.end_date) return null;
    // If engagement is not published on Engage, do not show any status.
    if (!this.isPublished()) return null;
    const now = new Date();
    // Engage API returns date-only strings (e.g. "2026-08-27" with no time).
    // Parse end_date as 23:59:59 Pacific so the engagement remains "Open"
    // until 11:59 PM Pacific on the closing day regardless of user timezone.
    const parseDate = (s: string, endOfDay: boolean) => {
      if (s.includes('T') || s.includes(' ')) return new Date(s);
      if (endOfDay) return pacificEndOfDay(s);
      return new Date(s + 'T00:00:00');
    };
    if (now < parseDate(eng.start_date, false)) return 'Upcoming';
    if (now > parseDate(eng.end_date, true)) return 'Closed';
    return 'Open';
  });

  ngOnInit() {
    this.engageApi.getEngagementByUrl(this.engagementUrl())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => { this.engagement.set(data); this.loading.set(false); },
        error: err => {
          this.logger.error('Failed to load Engage banner', 'EngageBannerComponent', err);
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}

/**
 * Returns a Date representing 23:59:59 Pacific for a date-only string ("YYYY-MM-DD").
 * Uses Intl to determine the correct UTC offset (handles PST/PDT automatically).
 */
export function pacificEndOfDay(dateStr: string): Date {
  // Create a date at 23:59:59 in Pacific by trying the offset.
  // Pacific is UTC-8 (PST) or UTC-7 (PDT). Use Intl to resolve.
  const [year, month, day] = dateStr.split('-').map(Number);
  // Start with a rough guess (UTC-7 for summer, UTC-8 for winter)
  const guess = new Date(Date.UTC(year, month - 1, day, 23 + 7, 59, 59));
  // Get actual Pacific offset at that moment
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', hour12: false });
  const parts = formatter.formatToParts(guess);
  const hourInPacific = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  // Adjust: we want hour 23 in Pacific. Current hour in Pacific is `hourInPacific`.
  const diff = 23 - hourInPacific;
  return new Date(guess.getTime() + diff * 3600_000);
}
