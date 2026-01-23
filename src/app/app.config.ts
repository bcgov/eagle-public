import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpInterceptorFn } from '@angular/common/http';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './interceptors/http-cache.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';

/**
 * Detect if the application is running in production environment
 */
function isProduction(): boolean {
  const deployment_env = window.localStorage.getItem('from_public_server--deployment_env');
  return deployment_env === 'prod';
}

/**
 * Build interceptors array based on environment
 * Production: only cache interceptor (logging overhead is removed)
 * Non-production: cache + logging interceptors for debugging
 */
function getHttpInterceptors(): HttpInterceptorFn[] {
  const interceptors: HttpInterceptorFn[] = [httpCacheInterceptor];
  
  // Only include logging interceptor in non-production environments
  if (!isProduction()) {
    interceptors.push(loggingInterceptor);
  }
  
  return interceptors;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors(getHttpInterceptors())),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
