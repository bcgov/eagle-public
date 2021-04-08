import { Component, OnDestroy, OnInit } from '@angular/core';
import { StorageService } from 'app/services/storage.service';
import { ConfigService } from 'app/services/config.service';
import { NavigationEnd, Router } from '@angular/router';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-project-details-tab',
  templateUrl: './project-details-tab.component.html',
  styleUrls: ['./project-details-tab-sm.component.scss', './project-details-tab-md-lg.component.scss'],
})
export class ProjectDetailsTabComponent implements OnInit, OnDestroy {
  public project;
  private alive = true;

  constructor(
    private storageService: StorageService,
    public configService: ConfigService,
    private router: Router
  ) { }

  ngOnInit() {
    this.project = this.storageService.state.currentProject.data;

    this.router.events.pipe(takeWhile(() => this.alive)).subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      const x = this.storageService.state.scrollPosition.data[0] ? this.storageService.state.scrollPosition.data[0] : 0;
      const y = this.storageService.state.scrollPosition.data[1] ? this.storageService.state.scrollPosition.data[1] : 0;
      if (x !== 0 || y !== 0) {
        window.scrollTo(x, y);
      }
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
