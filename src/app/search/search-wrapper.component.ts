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
import { UnifiedSearchComponent } from './unified-search.component';

/**
 * Wrapper that health-checks Typesense on init, then renders UnifiedSearchComponent
 * with typesenseAvailable=true/false so the 3 search tabs know whether to show results
 * or an unavailable message.
 *
 * Notifications and Map tabs always work regardless of Typesense status.
 */
@Component({
  selector: 'app-search-wrapper',
  standalone: true,
  imports: [UnifiedSearchComponent],
  template: `<app-unified-search [typesenseAvailable]="useTypesense()" />`,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  `],
})
export class SearchWrapperComponent implements OnInit {
  /** Shared cache — one health check per session. */
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
      console.warn('[SearchWrapper] Typesense health check failed — Typesense tabs unavailable');
      SearchWrapperComponent.cachedResult = false;
    }
  }
}
