import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';

@Component({
  selector: 'app-become-a-member',
  imports: [CommonModule, FormsModule],
  templateUrl: './become-a-member.component.html',
  styleUrls: ['./become-a-member.component.css'],
  standalone: true
})
export class BecomeAMemberComponent {
  private projectService = inject(ProjectService);
  public activeModal = inject(NgbActiveModal);
  
  project = input.required<Project>();
  
  submitting = signal(false);
  currentPage = signal(1);
  
  acknowledged = signal<boolean>(false);
  nameInput = signal('');
  emailInput = signal('');
  emailConfirmInput = signal('');
  liveNear = signal(false);
  liveNearInput = signal('');
  memberOf = signal(false);
  memberOfInput = signal('');
  knowledgeOf = signal(false);
  knowledgeOfInput = signal('');
  additionalNotesInput = signal('');
  termsOfReference = signal(false);

  p1_next() {
    this.currentPage.set(2);
  }

  async p2_next() {
    this.submitting.set(true);

    const signUpObject = {
      name: this.nameInput(),
      email: this.emailInput(),
      liveNear: this.liveNear(),
      liveNearInput: this.liveNearInput(),
      memberOf: this.memberOf(),
      memberOfInput: this.memberOfInput(),
      knowledgeOf: this.knowledgeOf(),
      knowledgeOfInput: this.knowledgeOfInput(),
      additionalNotes: this.additionalNotesInput()
    };

    try {
      const res = await this.projectService.cacSignUp(this.project(), signUpObject).toPromise();
      console.log('Success:', res);
      this.submitting.set(false);
      this.currentPage.set(3);
    } catch (error) {
      console.log('error', error);
      alert('Uh-oh, error submitting information');
      this.submitting.set(false);
    }
  }
}
