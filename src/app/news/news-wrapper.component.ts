import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ConfigService } from 'app/services/config.service';
import { NewsListComponent } from './news.component';
import { TypesenseActivitySearchComponent } from './typesense-activity-search.component';

/**
 * Wrapper that health-checks Typesense on init and renders the appropriate
 * news/activities UI.
 *
 * - TYPESENSE_ENABLED false or no key → legacy NewsListComponent (table view)
 * - /search-api/health responds       → TypesenseActivitySearchComponent (faceted search)
 * - health check fails/times out      → legacy NewsListComponent (silent fallback)
 *
 * Shares the static health-check cache with SearchWrapperComponent and
 * ProjectListWrapperComponent so only one health check fires per page session.
 */
@Component({
  selector: 'app-news-wrapper',
  standalone: true,
  imports: [NewsListComponent, TypesenseActivitySearchComponent],
  template: `
    @if (useTypesense()) {
      <app-typesense-activity-search />
    } @else {
      <app-news />
    }
  `,
})
export class NewsWrapperComponent implements OnInit {
  /** Shared cache across all wrapper components — one health check per session. */
  private static cachedResult: boolean | null = null;

  useTypesense = signal(false);

  private configService = inject(ConfigService);
  private http          = inject(HttpClient);

  async ngOnInit(): Promise<void> {
    const config = this.configService.config();

    if (!config.TYPESENSE_ENABLED || !config.TYPESENSE_SEARCH_KEY) {
      return;
    }

    if (NewsWrapperComponent.cachedResult !== null) {
      this.useTypesense.set(NewsWrapperComponent.cachedResult);
      return;
    }

    const searchHost = config.TYPESENSE_SEARCH_HOST || '/search-api';
    const healthUrl  = `${searchHost}/health`;

    try {
      await firstValueFrom(this.http.get(healthUrl).pipe(timeout(3000)));
      NewsWrapperComponent.cachedResult = true;
      this.useTypesense.set(true);
    } catch {
      console.warn('[NewsWrapper] Typesense health check failed — using legacy news list');
      NewsWrapperComponent.cachedResult = false;
    }
  }
}
