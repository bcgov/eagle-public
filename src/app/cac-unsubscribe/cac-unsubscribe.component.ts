import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from 'app/services/project.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { LoggingService } from 'app/services/logging.service';

@Component({
  selector: 'app-cac-unsubscribe',
  templateUrl: './cac-unsubscribe.component.html',
  styleUrl: './cac-unsubscribe.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class CACUnsubscribeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private loadingState = inject(LoadingStateService);
  private logger = inject(LoggingService);

  loading = this.loadingState.getOperationState('cac-unsubscribe');
  success = signal<boolean>(false);
  emailInput = signal<string>('');
  projectName = signal<string>('');
  projectId = signal<string>('');

  ngOnInit(): void {
    this.emailInput.set(this.route.snapshot.paramMap.get('email') || '');
    this.projectName.set(this.route.snapshot.paramMap.get('project') || '');
    this.projectId.set(this.route.snapshot.paramMap.get('projectId') || '');
  }

  cancel(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  unsubscribe(): void {
    this.projectService.cacRemoveMember(this.projectId(), {
      email: this.emailInput(),
      projId: this.projectId()
    })
    .subscribe({
      next: (res) => {
        this.logger.info('Successfully unsubscribed from CAC', 'CACUnsubscribeComponent', res);
        this.success.set(true);
      },
      error: (error) => {
        this.logger.error('Error unsubscribing from CAC', 'CACUnsubscribeComponent', error);
        alert('Uh-oh, error submitting information');
      }
    });
  }
}
