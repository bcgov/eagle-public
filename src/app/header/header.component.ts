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

  projectInfoFocused = signal<boolean>(false);
  eaProcessFocused = signal<boolean>(false);
  
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

  toggleDropdown(dropdown: 'projectInfo' | 'eaProcess'): void {
    this.projectInfoFocused.set(dropdown === 'projectInfo');
    this.eaProcessFocused.set(dropdown === 'eaProcess');
  }

  closeMenus(): void {
    this.projectInfoFocused.set(false);
    this.eaProcessFocused.set(false);
    
    if (isPlatformBrowser(this.platformId)) {
      document.getElementById('mainNav')?.classList.remove('show');
    }
  }
}
