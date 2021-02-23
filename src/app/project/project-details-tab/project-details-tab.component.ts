import { Component, OnInit } from '@angular/core';
import { StorageService } from 'app/services/storage.service';
import { ConfigService } from 'app/services/config.service';

@Component({
  selector: 'app-project-details-tab',
  templateUrl: './project-details-tab.component.html',
  styleUrls: ['./project-details-tab-sm.component.scss', './project-details-tab-md-lg.component.scss'],
})
export class ProjectDetailsTabComponent implements OnInit {
  public project;

  constructor(
    private storageService: StorageService,
    public configService: ConfigService,
  ) { }

  ngOnInit() {
    this.project = this.storageService.state.currentProject.data;
  }
}
