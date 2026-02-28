import { Component, ChangeDetectionStrategy, signal, inject, OnDestroy, PLATFORM_ID, effect, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ApiService } from '../services/api';
import { ConfigService } from '../services/config.service';
import { LoadingStateService } from '../services/loading-state.service';
import { filter, fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
  standalone: true
})
export class HeaderComponent implements OnDestroy {
  private apiService = inject(ApiService);
  private configService = inject(ConfigService);
  private platformId = inject(PLATFORM_ID);
  public router = inject(Router);
  
  // Public access to loading state service
  public loadingState = inject(LoadingStateService);
  
  // Reactive banner values - update when config changes
  envName = computed(() => this.configService.config().ENVIRONMENT || 'local');
  bannerColour = computed(() => this.configService.config().BANNER_COLOUR ?? 'red');
  showBanner = computed(() => {
    const env = this.envName();
    const colour = this.bannerColour();
    const hasValidColor = !!colour && colour !== 'no-banner-colour-set';
    return env === 'local' || (!!env && hasValidColor);
  });
  
  currentUrl = signal<string>('');
  
  private resizeSubscription: any = null;

  constructor() {
    // Update header height when banner visibility changes
    effect(() => {
      this.showBanner();
      if (isPlatformBrowser(this.platformId)) {
        this.updateHeaderHeight();
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      // Track current URL and update header height on navigation
      this.currentUrl.set(this.router.url);
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.currentUrl.set(this.router.url);
          this.updateHeaderHeight();
        });
      
      // Update header height on window resize
      this.resizeSubscription = fromEvent(window, 'resize')
        .pipe(debounceTime(100))
        .subscribe(() => this.updateHeaderHeight());
    }
  }

  private updateHeaderHeight(): void {
    setTimeout(() => {
      const headerElement = document.querySelector('.app-header') as HTMLElement;
      const totalHeight = headerElement ? `${headerElement.offsetHeight}px` : '0px';
      document.documentElement.style.setProperty('--header-total-height', totalHeight);
    }, 0);
  }

  // ngOnInit not needed - banner values are computed signals that react to config changes
  
  ngOnDestroy(): void {
    this.resizeSubscription?.unsubscribe();
  }

  closeMenus(): void {
    if (isPlatformBrowser(this.platformId)) {
      const mainNav = document.getElementById('mainNav');
      mainNav?.classList.remove('show');
      
      // Close any open Bootstrap dropdowns
      const dropdowns = document.querySelectorAll('.dropdown-menu.show');
      dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    }
  }
}
