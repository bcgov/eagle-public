import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { Router } from '@angular/router';

import { ApiService } from '../../services/api';
import { ProjectService } from '../../services/project.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-decisions-tab',
  imports: [],
  templateUrl: './decisions-tab.component.html',
  styleUrl: './decisions-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DecisionsTabComponent {
  private router = inject(Router);
  public api = inject(ApiService);
  public projectService = inject(ProjectService);
  private storageService = inject(StorageService);

  // Read current project from store — set by parent ProjectComponent on load
  public project = this.storageService.currentProject;
}
