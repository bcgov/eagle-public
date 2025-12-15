import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project } from '../../models/project';
import { ApiService } from '../../services/api';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-decisions-tab',
  imports: [CommonModule],
  templateUrl: './decisions-tab.component.html',
  styleUrls: ['./decisions-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionsTabComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public api = inject(ApiService);
  public projectService = inject(ProjectService);

  public project: Project = new Project();
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  ngOnInit() {
    // get project
    this.route.parent?.data
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        (data: any) => {
          if (data.project) {
            this.project = data.project;
          } else {
            this.project = new Project();
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
