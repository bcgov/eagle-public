import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Centralized responsive service for consistent breakpoint detection across components.
 * Eliminates duplicate breakpoint logic and provides reactive signals for responsive states.
 */
@Injectable({
  providedIn: 'root'
})
export class ResponsiveService implements OnDestroy {
  private breakpointObserver = inject(BreakpointObserver);
  private destroy$ = new Subject<void>();

  // Reactive signals for breakpoint states
  isMobile = signal(false);
  isTablet = signal(false);
  isDesktop = signal(false);

  constructor() {
    // Observe both tablet and desktop breakpoints in a single subscription
    this.breakpointObserver
      .observe([Breakpoints.Tablet, Breakpoints.Web])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        const isTablet = result.breakpoints[Breakpoints.Tablet];
        const isDesktop = result.breakpoints[Breakpoints.Web];

        this.isTablet.set(isTablet);
        this.isDesktop.set(isDesktop);
        this.isMobile.set(!isTablet && !isDesktop);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
