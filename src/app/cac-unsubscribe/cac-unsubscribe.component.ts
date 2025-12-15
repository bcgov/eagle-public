import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from 'app/services/project.service';

@Component({
  selector: 'app-cac-unsubscribe',
  templateUrl: './cac-unsubscribe.component.html',
  styleUrl: './cac-unsubscribe.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class CACUnsubscribeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private router = inject(Router);

  loading = signal<boolean>(false);
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
    this.loading.set(true);
    
    this.projectService.cacRemoveMember(this.projectId(), {
      email: this.emailInput(),
      projId: this.projectId()
    })
    .toPromise()
    .then((res: any) => {
      console.log('Success:', res);
      this.loading.set(false);
      this.success.set(true);
    })
    .catch(error => {
      console.log('error', error);
      this.loading.set(false);
      alert('Uh-oh, error submitting information');
    });
  }
}
