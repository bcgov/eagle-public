import { Component, Input } from '@angular/core';
import { Project } from 'app/models/project';

@Component({
  selector: 'details-sidebar',
  templateUrl: './details-sidebar.component.html',
  styleUrls: ['./details-sidebar.component.scss']
})

export class DetailsSidebarComponent {
  @Input() project: Project;

  public sidebarOpen = true;

  constructor(
  ) { }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
