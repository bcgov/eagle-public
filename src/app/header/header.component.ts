import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID, effect, Renderer2 } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ApiService } from '../services/api';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  standalone: true
})
export class HeaderComponent implements OnInit {
  private apiService = inject(ApiService);
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  public router = inject(Router);
  
  envName = signal<string>('');
  bannerColour = signal<string>('');
  showBanner = signal<boolean>(false);
  currentUrl = signal<string>('');

  constructor() {
    // Update CSS variable when header size changes (includes banner when visible)
    effect(() => {
      // Track the banner signal to re-run when it changes
      this.showBanner();
      
      if (isPlatformBrowser(this.platformId)) {
        this.updateHeaderHeight();
      }
    });

    // Recalculate on route changes
    if (isPlatformBrowser(this.platformId)) {
      this.currentUrl.set(this.router.url);
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.currentUrl.set(this.router.url);
          this.updateHeaderHeight();
        });
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
