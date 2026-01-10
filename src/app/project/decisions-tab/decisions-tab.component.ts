import { Component, OnInit, inject, ChangeDetectionStrategy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Project } from '../../models/project';
import { ApiService } from '../../services/api';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-decisions-tab',
  imports: [CommonModule],
  templateUrl: './decisions-tab.component.html',
  styleUrl: './decisions-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DecisionsTabComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public api = inject(ApiService);
  public projectService = inject(ProjectService);

  public project = signal<Project>(new Project());

  constructor() {
    // Use effect to react to route data changes
    effect(() => {
      this.route.parent?.data.subscribe((data: any) => {
        if (data.project) {
          this.project.set(data.project);
        } else {
          this.project.set(new Project());
          alert('Uh-oh, couldn\'t load project');
          // project not found --> navigate back to project list
          this.router.navigate(['/projects']);
        }
      });
    });
  }

  ngOnInit() {
    // Component initialization if needed
  }
}
