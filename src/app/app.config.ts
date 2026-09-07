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
    provideAppInitializer(async () => {
      const configService = inject(ConfigService);
      const analyticsService = inject(AnalyticsService);

      // Load config — awaits the /api/config fetch before anything reads a config value.
      await configService.init();

      // Initialize analytics. A no-op while this line has no tracker.
      analyticsService.initialize();
    })
  ]
};
