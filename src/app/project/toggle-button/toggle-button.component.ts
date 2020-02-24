import { Component } from '@angular/core';

@Component({
  selector: 'app-toggle-button',
  templateUrl: './toggle-button.component.html',
  styleUrls: ['./toggle-button.component.scss']
})

export class ToggleButtonComponent {

  public sidebarOpen = false;

  constructor(
  ) { }

  toggleSideNav() {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
