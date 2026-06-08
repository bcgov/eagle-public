import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { ConfigService } from './config.service';

export interface EngageEngagementStatus {
  id: number;
  status_name: string;
}

export interface EngageEngagement {
  id: number;
  name: string;
  banner_url: string;
  description: string;
  rich_description: string;
  start_date: string;
  end_date: string;
  engagement_status: EngageEngagementStatus;
  is_internal: boolean;
}

/** Engagement is considered visible to the public when published and not internal. */
export function isEngagementPublished(eng: EngageEngagement): boolean {
  const status = eng.engagement_status?.status_name?.toLowerCase();
  return (status === 'published' || status === 'open' || status === 'closed') && !eng.is_internal;
}

@Injectable({ providedIn: 'root' })
export class EngageApiService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  private get baseUrl(): string {
    return this.configService.config().ENGAGE_API_URL || '/engage-api';
  }

  /**
   * Fetch engagement data by slug extracted from a full Engage URL.
   * Returns cached data synchronously on repeat calls; fetches from API on first call.
   * Handles formats:
   *   https://engage.eao.gov.bc.ca/engagements/NewPolaris-AR/overview
   *   https://engage.eao.gov.bc.ca/engagements/NewPolaris-AR
   *   https://engage.eao.gov.bc.ca/NewPolaris-AR
   */
  getEngagementByUrl(engagementUrl: string): Observable<EngageEngagement> {
    const slug = this.extractSlug(engagementUrl);
    return this.http
      .get<{ engagement_id: number; slug: string }>(`${this.baseUrl}/slugs/${slug}`)
      .pipe(
        switchMap(slugData =>
          this.http.get<EngageEngagement>(`${this.baseUrl}/engagements/${slugData.engagement_id}`)
        ),
      );
  }

  private extractSlug(url: string): string {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      // /engagements/{slug} or /engagements/{slug}/page → extract segment after 'engagements'
      const engIdx = segments.indexOf('engagements');
      if (engIdx !== -1 && segments[engIdx + 1]) {
        return segments[engIdx + 1];
      }
      // Bare slug at root: /{slug}
      return segments[segments.length - 1] || url;
    } catch {
      // Not a valid URL — treat whole string as slug
      return url;
    }
  }
}
