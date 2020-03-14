import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from 'app/services/project.service';

@Component({
  selector: 'app-cac-unsubscribe',
  templateUrl: './cac-unsubscribe.component.html',
  styleUrls: ['./cac-unsubscribe.component.scss']
})
export class CACUnsubscribeComponent implements OnInit {
  public loading: Boolean = false;
  public success: Boolean = false;
  public emailInput: String = '';
  public projectName: String = '';
  public projectId: String = '';
  constructor(
    private route: ActivatedRoute,
    private _changeDetectionRef: ChangeDetectorRef,
    private projectService: ProjectService,
    private router: Router
  ) { }

  ngOnInit() {
      this.emailInput = this.route.snapshot.paramMap.get('email');
      this.projectName = this.route.snapshot.paramMap.get('project');
      this.projectId = this.route.snapshot.paramMap.get('projectId');
  }

  cancel() {
    // Navigate one level up
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  unsubscribe() {
    this.loading = true;
    this._changeDetectionRef.detectChanges();
    // Remove them from the list.
    this.projectService.cacRemoveMember(this.projectId, {
      email: this.emailInput,
      projId: this.projectId
    })
    .toPromise()
    .then((res: any) => {
      console.log('Success:', res);
      this.loading = false;
      this.success = true;
      this._changeDetectionRef.detectChanges();
    })
    .catch(error => {
      console.log('error', error);
      this.loading = false;
      this._changeDetectionRef.detectChanges();
      alert('Uh-oh, error submitting information');
    });
  }
}
