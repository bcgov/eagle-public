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
import { SearchComponent } from './search.component';
import { TypesenseDocumentSearchComponent } from './typesense-document-search.component';

/**
 * Wrapper that health-checks Typesense on init and renders the appropriate
 * document search UI.
 *
 * - TYPESENSE_ENABLED false or no key → legacy SearchComponent
 * - /search-api/health responds       → TypesenseDocumentSearchComponent
 * - health check fails/times out      → legacy SearchComponent (silent fallback)
 *
 * Shares the same static cache as ProjectListWrapperComponent so only one
 * health check fires per page session.
 */
@Component({
  selector: 'app-search-wrapper',
  standalone: true,
  imports: [SearchComponent, TypesenseDocumentSearchComponent],
  template: `
    @if (useTypesense()) {
      <app-typesense-document-search />
    } @else {
      <app-search />
    }
  `,
})
export class SearchWrapperComponent implements OnInit {
  /** Shared cache with ProjectListWrapperComponent — one health check per session. */
  private static cachedResult: boolean | null = null;

  useTypesense = signal(false);

  private configService = inject(ConfigService);
  private http = inject(HttpClient);

  async ngOnInit(): Promise<void> {
    const config = this.configService.config();

    if (!config.TYPESENSE_ENABLED || !config.TYPESENSE_SEARCH_KEY) {
      return;
    }

    if (SearchWrapperComponent.cachedResult !== null) {
      this.useTypesense.set(SearchWrapperComponent.cachedResult);
      return;
    }

    const searchHost = config.TYPESENSE_SEARCH_HOST || '/search-api';
    const healthUrl = `${searchHost}/health`;

    try {
      await firstValueFrom(this.http.get(healthUrl).pipe(timeout(3000)));
      SearchWrapperComponent.cachedResult = true;
      this.useTypesense.set(true);
    } catch {
      console.warn('[SearchWrapper] Typesense health check failed — using legacy document search');
      SearchWrapperComponent.cachedResult = false;
    }
  }
}
