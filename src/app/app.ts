import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { ConfigService } from './services/config.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class App implements OnInit, OnDestroy {
  private configService = inject(ConfigService);
  public router = inject(Router);
  
  title = 'EPIC - Environmental Assessment Office';
  showScrollButton = signal(false);
  currentUrl = signal<string>('');

  ngOnInit(): void {
    // Initialize config service
    this.configService.init();
    this.configService.lists.subscribe();
    
    // Track current URL for route-specific styling
    this.currentUrl.set(this.router.url);
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.currentUrl.set(this.router.url));
    
    // Show/hide scroll-to-top button based on scroll position
    window.addEventListener('scroll', this.handleScroll);
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
