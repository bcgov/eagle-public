import { Component, Input, OnInit } from '@angular/core';
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
  public acknowledged: any;

  // CAC
  public nameInput: string;
  public emailInput: any;
  public emailConfirmInput: any;
  public liveNear: boolean;
  public liveNearInput: any;
  public memberOf: boolean;
  public memberOfInput: any;
  public knowledgeOf: boolean;
  public knowledgeOfInput: any;
  public additionalNotesInput: any;

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

  private p2_next() {
    this.submitting = true;

    // Build the comment
    let signUpObject = {
      name: this.nameInput,
      email: this.emailInput,
      liveNear: this.liveNear,
      liveNearInput: this.liveNearInput,
      memberOf: this.memberOf,
      memberOfInput: this.memberOfInput,
      knowledgeOf: this.knowledgeOf,
      knowledgeOfInput: this.knowledgeOfInput,
      additionalNotes: this.additionalNotesInput
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
      alert('Uh-oh, error submitting information');
      this.submitting = false;
    });
  }
}
