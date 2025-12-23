import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy, PLATFORM_ID, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ApiService } from '../services/api';
import { LoadingStateService } from '../services/loading-state.service';
import { filter, fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  standalone: true
})
export class HeaderComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private platformId = inject(PLATFORM_ID);
  public router = inject(Router);
  
  // Public access to loading state service
  public loadingState = inject(LoadingStateService);
  
  envName = signal<string>('');
  bannerColour = signal<string>('');
  showBanner = signal<boolean>(false);
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

  ngOnInit(): void {
    const { env, bannerColour } = this.apiService;
    
    this.envName.set(env);
    this.bannerColour.set(bannerColour);
    
    const hasValidColor = !!bannerColour && bannerColour !== 'no-banner-colour-set';
    this.showBanner.set(env === 'local' || (!!env && hasValidColor));
  }
  
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
