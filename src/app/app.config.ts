import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';
import { ConfigService } from './services/config.service';
import { AnalyticsService } from './services/analytics/analytics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpCacheInterceptor, loggingInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      const analyticsService = inject(AnalyticsService);

      // Load config from env.js (sync). If deployed, kicks off non-blocking /api/config fetch.
      configService.init();

      // Initialize analytics. Skips silently if ANALYTICS_API_URL is empty.
      analyticsService.initialize();
      analyticsService.startTracking();
    })
  ]
};
