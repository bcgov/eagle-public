import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project } from '../models/project';
import { ProjectService } from '../services/project.service';
import { CommentPeriodService } from '../services/commentperiod.service';
import { StorageService } from '../services/storage.service';

@Component({
  selector: 'app-project',
  imports: [CommonModule, RouterModule],
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  standalone: true
})
export class ProjectComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private commentPeriodService = inject(CommentPeriodService);
  private storageService = inject(StorageService);

  public project = signal<Project | null>(null);
  public loading = signal(true);
  public sidebarOpen = signal(true);
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public tabLinks = signal<Array<any>>([
    {
      label: 'Project Details',
      link: 'project-details',
      display: true,
    },
    {
      label: 'Commenting',
      link: 'commenting',
      display: true,
    },
    {
      label: 'Documents',
      link: 'documents',
      display: true,
    },
    {
      label: 'Decisions',
      link: 'decisions',
      display: true,
    },
    {
      label: 'Amendments',
      link: 'amendments',
      display: true,
    },
    {
      label: 'Certificates',
      link: 'certificates',
      display: true,
    }
  ]);

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(params => {
        const projectId = params['projId'];
        if (projectId) {
          this.loadProject(projectId);
        }
      });
  }

  private loadProject(projectId: string): void {
    this.loading.set(true);
    this.projectService.getById(projectId, true)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (project: Project | null) => {
          this.project.set(project);
          this.loading.set(false);
          if (project) {
            this.storageService.state.currentProject = { type: 'currentProject', data: project };
          }
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
