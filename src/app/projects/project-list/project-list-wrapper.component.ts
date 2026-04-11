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
import { ProjectListComponent } from './project-list.component';
import { TypesenseProjectSearchComponent } from './typesense-search.component';

/**
 * Wrapper that health-checks Typesense on init.
 *
 * - If TYPESENSE_ENABLED is false or the key is missing → render existing search
 * - If /search-api/health responds → render Typesense InstantSearch UI
 * - If health check times out or errors → fall back to existing search silently
 *
 * The health-check result is cached statically so navigating back to this route
 * does not re-run the check on every visit.
 */
@Component({
  selector: 'app-project-list-wrapper',
  standalone: true,
  imports: [ProjectListComponent, TypesenseProjectSearchComponent],
  template: `
    @if (useTypesense()) {
      <app-typesense-project-search />
    } @else {
      <app-project-list />
    }
  `,
})
export class ProjectListWrapperComponent implements OnInit {
  /** Cached result: null = not yet checked, true/false = resolved */
  private static cachedResult: boolean | null = null;

  useTypesense = signal(false);

  private configService = inject(ConfigService);
  private http = inject(HttpClient);

  async ngOnInit(): Promise<void> {
    const config = this.configService.config();

    if (!config.TYPESENSE_ENABLED || !config.TYPESENSE_SEARCH_KEY) {
      return;
    }

    // Return cached result immediately — no HTTP call on subsequent visits
    if (ProjectListWrapperComponent.cachedResult !== null) {
      this.useTypesense.set(ProjectListWrapperComponent.cachedResult);
      return;
    }

    const searchHost = config.TYPESENSE_SEARCH_HOST || '/search-api';
    const healthUrl = `${searchHost}/health`;

    try {
      await firstValueFrom(this.http.get(healthUrl).pipe(timeout(3000)));
      ProjectListWrapperComponent.cachedResult = true;
      this.useTypesense.set(true);
    } catch {
      console.warn('[ProjectListWrapper] Typesense health check failed — using default search');
      ProjectListWrapperComponent.cachedResult = false;
    }
  }
}
