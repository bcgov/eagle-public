import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

import { Project } from 'app/models/project';
import { Constants } from 'app/shared/utils/constants';

@Component({
  selector: 'details-sidebar',
  templateUrl: './details-sidebar.component.html',
  styleUrls: ['./details-sidebar.component.scss']
})

export class DetailsSidebarComponent implements OnInit {
  @Input() project: Project;
  @Output() onSidebarToggle: EventEmitter<any> = new EventEmitter();

  public sidebarOpen = true;
  public legislationLink: string;

  constructor(
  ) { }

  ngOnInit() {
    if (this.project.legislation.includes('2002')) {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
    } else if  (this.project.legislation.includes('1996')) {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
    } else {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK;
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    this.onSidebarToggle.emit({ open: this.sidebarOpen });
  }
}
