import { Observable, defer, MonoTypeOperatorFunction } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingStateService } from 'app/services/loading-state.service';

/**
 * RxJS operator that wraps an observable with loading state management.
 * Calls startLoading on subscribe, stopLoading on complete or error.
 * Eliminates the repeated start/stop boilerplate in data services.
 *
 * Usage:
 *   return this.api.call().pipe(
 *     withLoading(this.loadingState, 'my-op', 'Loading...'),
 *     map(res => transform(res)),
 *     catchError(err => this.api.handleError(err))
 *   );
 */
export function withLoading<T>(
  loadingState: LoadingStateService,
  id: string,
  description?: string
): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) =>
    defer(() => {
      loadingState.startLoading(id, description);
      return source.pipe(finalize(() => loadingState.stopLoading(id)));
    });
}
