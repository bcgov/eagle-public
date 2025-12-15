import { Component, OnInit, input, output, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Project } from '../../models/project';
import { Constants } from '../../shared/utils/constants';

@Component({
  selector: 'details-sidebar',
  imports: [CommonModule],
  templateUrl: './details-sidebar.html',
  styleUrls: ['./details-sidebar.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DetailsSidebarComponent implements OnInit {
  project = input.required<Project | null>();
  onSidebarToggle = output<{ open: boolean }>();

  public sidebarOpen = signal(true);
  public legislationLink = signal<string>('');

  ngOnInit() {
    const proj = this.project();
    if (proj) {
      if (proj.legislation.includes('2002')) {
        this.legislationLink.set(Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK);
      } else if (proj.legislation.includes('1996')) {
        this.legislationLink.set(Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK);
      } else {
        this.legislationLink.set(Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK);
      }
    }
  }

  toggleSidebar() {
    this.sidebarOpen.update(open => !open);
    this.onSidebarToggle.emit({ open: this.sidebarOpen() });
  }
}
