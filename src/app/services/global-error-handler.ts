import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggingService } from './logging.service';

// Angular passes a failed app initializer to the ErrorHandler and then rejects bootstrap with it.
const reported = new WeakSet<object>();

/** Catch for `bootstrapApplication`: logs only a failure the ErrorHandler has not logged already. */
export function logBootstrapFailure(error: unknown): void {
  if (typeof error === 'object' && error !== null && reported.has(error)) return;
  // Bootstrap failed, so there is no injector to ask for the logger.
  new LoggingService().error('bootstrap failed', 'main', error);
}

/**
 * Global error handler that catches all unhandled errors
 * and logs them using LoggingService
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggingService);

  handleError(error: Error | any): void {
    if (typeof error === 'object' && error !== null) reported.add(error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const stack = error?.stack;

    // Log the error with full details
    this.logger.error(
      `Unhandled Error: ${errorMessage}`,
      'GlobalErrorHandler',
      { error, stack }
    );

    // In development, also throw to preserve default behavior
    if (typeof window !== 'undefined' && (window as any).ng?.probe) {
      console.error('Original error:', error);
    }
  }
}
