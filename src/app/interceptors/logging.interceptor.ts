import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { LoggingService } from '../services/logging.service';

/**
 * HTTP interceptor that logs all requests and responses
 * Automatically logs errors with detailed information
 * 
 * Note: This interceptor is only included in non-production environments.
 * In production, all HTTP logging is disabled to reduce overhead.
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggingService);

  // Log outgoing request
  logger.logHttpRequest(req.method, req.url, 'HttpInterceptor');

  return next(req).pipe(
    tap(event => {
      // Log successful response (if it's an HttpResponse)
      if ((event as any).status !== undefined) {
        logger.logHttpResponse(
          req.method,
          req.url,
          (event as any).status,
          undefined,
          'HttpInterceptor'
        );
      }
    }),
    catchError(error => {
      // Log error response
      logger.logHttpError(req.method, req.url, error, 'HttpInterceptor');
      return throwError(() => error);
    })
  );
};
