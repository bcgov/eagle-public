import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpInterceptorFn } from '@angular/common/http';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';
import { ConfigService } from './services/config.service';
import { AnalyticsService } from './services/analytics/analytics.service';

/**
 * Build interceptors array based on environment
 * Production: only cache interceptor (logging overhead is removed)
 * Non-production: cache + logging interceptors for debugging
 */
function getHttpInterceptors(): HttpInterceptorFn[] {
  // Always include cache interceptor, logging interceptor is lightweight
  // and helps with debugging in all environments
  return [httpCacheInterceptor, loggingInterceptor];
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors(getHttpInterceptors())),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(async () => {
      const configService = inject(ConfigService);
      const analyticsService = inject(AnalyticsService);
      
      // Load configuration from API
      await configService.init();
      
      // Initialize analytics with loaded config
      analyticsService.initialize();
      analyticsService.startTracking();
    })
  ]
};
