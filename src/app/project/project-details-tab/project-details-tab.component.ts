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
  styleUrl: './project-details-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailsTabComponent implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  public configService = inject(ConfigService);
  private router = inject(Router);

  // Use the reactive signal from storageService
  public project = this.storageService.currentProject;
  private alive = true;

  ngOnInit() {
    this.router.events.pipe(takeWhile(() => this.alive)).subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      const [x = 0, y = 0] = this.storageService.state.scrollPosition?.data || [0, 0];
      if (x !== 0 || y !== 0) {
        window.scrollTo(x, y);
      }
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
