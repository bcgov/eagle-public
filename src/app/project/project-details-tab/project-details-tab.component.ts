import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../services/storage.service';
import { ConfigService } from '../../services/config.service';
import { NavigationEnd, Router } from '@angular/router';
import { takeWhile } from 'rxjs/operators';
import { NewlinesPipe } from '../../shared/pipes/newlines.pipe';
import { FeaturedDocumentsComponent } from '../featured-documents/featured-documents.component';
import { PinsComponent } from '../pins/pins.component';
import { ProjectActivitesComponent } from '../project-activites/project-activites.component';

@Component({
  selector: 'app-project-details-tab',
  imports: [CommonModule, NewlinesPipe, FeaturedDocumentsComponent, PinsComponent, ProjectActivitesComponent],
  templateUrl: './project-details-tab.component.html',
  styleUrls: ['./project-details-tab-sm.component.css', './project-details-tab-md-lg.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ProjectDetailsTabComponent implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  public configService = inject(ConfigService);
  private router = inject(Router);

  public project: any;
  private alive = true;

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
