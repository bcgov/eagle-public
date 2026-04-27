import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';
import { Injectable } from '@angular/core';

/**
 * Custom route reuse strategy that forces ProjectComponent (and all child route
 * components) to be fully destroyed and recreated when :projId changes.
 *
 * Without this, Angular reuses component instances when navigating between
 * projects — ngOnDestroy never fires, causing accumulating subscriptions,
 * stale maps, and frozen pages on the second project visit.
 */
@Injectable()
export class ProjectRouteReuseStrategy implements RouteReuseStrategy {
  shouldDetach(_route: ActivatedRouteSnapshot): boolean { return false; }
  store(_route: ActivatedRouteSnapshot, _handle: DetachedRouteHandle | null): void { /* noop */ }
  shouldAttach(_route: ActivatedRouteSnapshot): boolean { return false; }
  retrieve(_route: ActivatedRouteSnapshot): DetachedRouteHandle | null { return null; }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) {
      return false;
    }
    // Only force recreation for the project route segment when :projId changes.
    // Scoping to path 'p/:projId' prevents false-positives on other routes that
    // also happen to carry a projId param (comment period routes, redirects, etc.).
    if (future.routeConfig?.path === 'p/:projId') {
      return future.params['projId'] === curr.params['projId'];
    }
    return true;
  }
}
