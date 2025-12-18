import { Component, ChangeDetectionStrategy, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api';

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
  public router = inject(Router);
  
  envName = signal<string>('');
  bannerColour = signal<string>('');
  showBanner = signal<boolean>(false);

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
