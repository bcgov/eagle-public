import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';

import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { AnalyticsService } from './services/analytics/analytics.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  public router = inject(Router);
  
  title = 'EPIC - Environmental Assessment Office';
  showScrollButton = signal(false);
  currentUrl = signal<string>('');
  isContentSearch = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/search') && /[?&]tab=content/.test(url);
  });

  ngOnInit(): void {
    // Track current URL for route-specific styling and analytics
    this.currentUrl.set(this.router.url);
    
    // Track initial page view
    const initialPageName = this.getPageName(this.router.url);
    this.analyticsService.page(initialPageName, { path: this.router.url });
    
    // Track page views on route navigation
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const routePath = event.urlAfterRedirects || event.url;
        this.currentUrl.set(routePath);

        // Track page view
        const pageName = this.getPageName(routePath);
        this.analyticsService.page(pageName, { path: routePath });
      });
    
    // Show/hide scroll-to-top button based on scroll position
    window.addEventListener('scroll', this.handleScroll);
  }

  /**
   * Extract a human-readable page name from a URL path.
   * Removes project IDs and converts to title case.
   * 
   * Examples:
   * - '/projects' => 'Projects'
   * - '/p/abc123/documents' => 'Project > Documents'
   * - '/search' => 'Search'
   */
  private getPageName(path: string): string {
    if (!path || path === '/') return 'Home';
    
    // Remove leading slash and query params
    const cleanPath = path.split('?')[0].replace(/^\//, '');
    
    // Split into segments
    const segments = cleanPath.split('/');
    
    // Filter out IDs (UUIDs or long alphanumeric strings)
    const filteredSegments = segments.filter(segment => {
      // Skip segments that look like IDs (UUIDs or long alphanumeric)
      if (/^[0-9a-f-]{20,}$/i.test(segment)) return false;
      // Skip 'p' prefix for project routes
      if (segment === 'p') return false;
      // Skip 'cp' prefix for comment period routes  
      if (segment === 'cp') return false;
      return segment.length > 0;
    });
    
    if (filteredSegments.length === 0) return 'Project';
    
    // Convert to title case and join with ' > '
    return filteredSegments
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
      .join(' > ');
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.handleScroll);
  }

  private handleScroll = (): void => {
    // Show button when scrolled down more than 300px
    this.showScrollButton.set(window.scrollY > 300);
  };

  scrollToTop(event: Event) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
