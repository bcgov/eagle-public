import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class App implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  
  title = 'EPIC - Environmental Assessment Office';
  showScrollButton = signal(false);

  ngOnInit(): void {
    // Start preloading projects in the background
    this.storageService.preloadProjects();
    
    // Listen for scroll events to show/hide scroll-to-top button
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
