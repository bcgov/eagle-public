import { Component, ChangeDetectionStrategy, inject, AfterViewInit, OnDestroy, ElementRef, effect } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { ApiService } from 'app/services/api';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
  standalone: true
})
export class FooterComponent implements AfterViewInit, OnDestroy {
  public api = inject(ApiService);
  public router = inject(Router);
  private elementRef = inject(ElementRef);
  private resizeListener: () => void;
  private updateFooterHeightTimeoutId: any = null;

  constructor() {
    // Update footer height on route changes
    effect(() => {
      const _url = this.router.url;
      this.updateFooterHeightTimeoutId = setTimeout(() => this.updateFooterHeight(), 0);
    });
    
    // Bind the resize listener so we can remove it later
    this.resizeListener = () => this.updateFooterHeight();
  }

  ngAfterViewInit() {
    this.updateFooterHeight();
    // Also update on window resize
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy() {
    // Clean up event listener
    window.removeEventListener('resize', this.resizeListener);
    
    // Clear any pending timeout
    if (this.updateFooterHeightTimeoutId) {
      clearTimeout(this.updateFooterHeightTimeoutId);
      this.updateFooterHeightTimeoutId = null;
    }
  }

  private updateFooterHeight() {
    const footerElement = this.elementRef.nativeElement.querySelector('.app-footer');
    if (footerElement) {
      const height = footerElement.offsetHeight;
      document.documentElement.style.setProperty('--footer-height', `${height}px`);
    }
  }
}
