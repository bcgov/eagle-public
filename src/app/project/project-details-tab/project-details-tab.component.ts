import { Component, OnInit, ElementRef } from '@angular/core';

import { StorageService } from 'app/services/storage.service';
import { Subject } from 'rxjs';
import { ConfigService } from 'app/services/config.service';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-project-details-tab',
  templateUrl: './project-details-tab.component.html',
  styleUrls: ['./project-details-tab-sm.component.scss', './project-details-tab-md-lg.component.scss'],
})
export class ProjectDetailsTabComponent implements OnInit {
  public project;
  public commentPeriod = null;

  constructor(
    private storageService: StorageService,
    public configService: ConfigService
  ) { }

  ngOnInit() {
    this.project = this.storageService.state.currentProject.data;
    this.commentPeriod = this.project.commentPeriodForBanner;
  }
}
