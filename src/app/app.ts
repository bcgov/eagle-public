import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
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
export class App implements OnInit {
  private storageService = inject(StorageService);
  
  title = 'EPIC - Environmental Assessment Office';

  ngOnInit(): void {
    // Start preloading projects in the background
    this.storageService.preloadProjects();
  }
}
