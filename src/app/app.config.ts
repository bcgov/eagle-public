import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';
import { ConfigService } from './services/config.service';
import { AnalyticsService } from './services/analytics/analytics.service';

const UNAVAILABLE_PAGE = `<main class="container py-5">
  <h1>EPIC is temporarily unavailable</h1>
  <p>The site could not load its configuration. Reload the page to try again.</p>
</main>`;

/**
 * Loads the runtime config and builds the analytics client. When the config cannot be loaded,
 * shows the unavailable page and rejects, which stops bootstrap before any component renders.
 */
export async function initializeApp(): Promise<void> {
  const configService = inject(ConfigService);
  const analyticsService = inject(AnalyticsService);

  try {
    await configService.init();
  } catch (e) {
    const root = document.querySelector('app-root') ?? document.body;
    root.innerHTML = UNAVAILABLE_PAGE;
    throw e;
  }

  // Must follow config.init(): EAGLE_ANALYTICS_URL comes only from the runtime config, and an
  // empty value leaves the client a no-op.
  analyticsService.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpCacheInterceptor, loggingInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(initializeApp)
  ]
};
