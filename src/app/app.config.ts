import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';
import { ConfigService } from './services/config.service';
import { AnalyticsService } from './services/analytics/analytics.service';
import { ProjectRouteReuseStrategy } from './route-reuse-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpCacheInterceptor, loggingInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: RouteReuseStrategy, useClass: ProjectRouteReuseStrategy },
    provideAppInitializer(async () => {
      const configService = inject(ConfigService);
      const analyticsService = inject(AnalyticsService);

      // Load config — awaits /api/config fetch so analytics gets correct environment values.
      await configService.init();

      // Initialize analytics. Skips silently if ANALYTICS_API_URL is empty.
      analyticsService.initialize();
      analyticsService.startTracking();
    })
  ]
};
