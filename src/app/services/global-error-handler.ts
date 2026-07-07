import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggingService } from './logging.service';

/**
 * Global error handler that catches all unhandled errors
 * and logs them using LoggingService
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggingService);

  handleError(error: Error | any): void {
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
