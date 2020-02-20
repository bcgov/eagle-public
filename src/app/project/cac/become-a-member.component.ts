import { Component, Input, OnInit } from '@angular/core';
// import { HttpEventType } from '@angular/common/http';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/observable/forkJoin';

import { ProjectService } from 'app/services/project.service';
import * as moment from 'moment-timezone';
import { Project } from 'app/models/project';
import { ConfigService } from 'app/services/config.service';
import { AbstractControl } from '@angular/forms';

@Component({
  templateUrl: './become-a-member.component.html',
  styleUrls: ['./become-a-member.component.scss']
})

export class BecomeAMemberComponent implements OnInit {
  @Input() project: Project;

  public submitting = false;
  private progressValue: number;
  private progressBufferValue: number;
  public totalSize: number;
  public currentPage = 1;
  private comment: Comment;
  public contactName: string;
  public email: any;
  public emailInput: any;
  public commentInput: any;
  public acknowledged: any;
  public emailConfirm: any;

  constructor(
    public activeModal: NgbActiveModal,
    private projectService: ProjectService,
  ) { }

  ngOnInit() {
    this.comment = new Comment();
  }

  private p1_next() {
    this.currentPage++;
  }

  // TODO: Have some null checks in here from the front end
  private p2_next() {
    this.submitting = true;

    // Build the comment
    let signUpObject = {
      name: this.contactName,
      email: this.email,
      comment: this.commentInput,
    };

    this.projectService.cacSignUp(this.project, signUpObject)
    .toPromise()
    .then((res: any) => {
      console.log('Success:', res);
      this.submitting = false;
      this.currentPage++;
    })
    .catch(error => {
      console.log('error', error);
      alert('Uh-oh, error submitting informaiton');
      this.submitting = false;
    });
  }
}
