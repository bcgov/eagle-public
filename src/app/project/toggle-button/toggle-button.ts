import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toggle-button',
  imports: [CommonModule],
  templateUrl: './toggle-button.html',
  styleUrls: ['./toggle-button.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToggleButtonComponent {
  public sidebarOpen = signal(false);

  toggleSideNav() {
    this.sidebarOpen.update(open => !open);
  }
}
