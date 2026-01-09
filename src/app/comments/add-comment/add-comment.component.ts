import { Component, inject, signal, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { Comment } from '../../models/comment';
import { Document } from '../../models/document';
import { CommentPeriod } from '../../models/commentperiod';
import { CommentService } from '../../services/comment.service';
import { DocumentService } from '../../services/document.service';
import { Project } from '../../models/project';
import { ConfigService } from '../../services/config.service';
import { ProjectService } from '../../services/project.service';
import { FileUploadComponent } from '../../file-upload/file-upload.component';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-add-comment',
  imports: [CommonModule, FormsModule, FileUploadComponent],
  templateUrl: './add-comment.component.html',
  styleUrls: ['./add-comment.component.css'],
  standalone: true
})
export class AddCommentComponent implements OnInit {
  public activeModal = inject(NgbActiveModal);
  private commentService = inject(CommentService);
  private projectService = inject(ProjectService);
  private documentService = inject(DocumentService);
  private config = inject(ConfigService);
  private logger = inject(LoggingService);

  currentPeriod = input<CommentPeriod>();
  project = input<Project>();

  submitting = signal(false);
  progressValue = signal(0);
  progressBufferValue = signal(0);
  totalSize = signal(0);
  currentPage = signal(1);
  
  comment = signal<Comment>(new Comment());
  files = signal<Array<File>>([]);
  documents = signal<Document[]>([]);
  documentAuthor = signal<any>(null);
  documentAuthorType = signal<any>(null);
  contactName = signal('');
  commentInput = signal('');
  locationInput = signal('');
  makePublic = signal(false);
  commentFiles = signal<any[]>([]);
  anonymousName = 'Anonymous';
  commentTip = signal<string>('');

  // CAC
  nameInput = signal('');
  emailInput = signal('');
  emailConfirmInput = signal('');
  caclocationInput = signal('');
  liveNear = signal(false);
  liveNearInput = signal('');
  memberOf = signal(false);
  memberOfInput = signal('');
  knowledgeOf = signal(false);
  knowledgeOfInput = signal('');
  additionalNotesInput = signal('');
  submittedCAC = signal(false);
  hasSeenCAC = signal(false);
  agreeConditions = signal(false);
  acknowledged = signal(false);
  termsOfReference = signal(false);

  ngOnInit() {
    this.hasSeenCAC.set(false);
    const newComment = new Comment();
    const period = this.currentPeriod();
    if (period) {
      newComment.period = period._id;
      this.commentTip.set(String(period.commentTip || ''));
    }
    newComment.isAnonymous = true;
    this.comment.set(newComment);
    this.contactName.set(this.anonymousName);
    this.submittedCAC.set(false);
    this.commentFiles.set([]);
    this.documentAuthorType.set(null);
    this.getLists();
  }

  publicChecked() {
    this.contactName.set(this.makePublic() ? '' : this.anonymousName);
  }

  addFiles(files: File[]) {
    if (files) {
      const currentCommentFiles = [...this.commentFiles()];
      const currentDocuments = [...this.documents()];
      
      for (let i = 0; i < files.length; i++) {
        if (files[i]) {
          // ensure file is not already in the list
          if (currentDocuments.find(x => x.documentFileName === files[i].name)) {
            continue;
          }
          currentCommentFiles.push(files[i]);
          const document = new Document();
          document.upfile = files[i];
          document.documentFileName = files[i].name;
          document.internalOriginalName = files[i].name;
          currentDocuments.push(document);
        }
      }
      
      this.commentFiles.set(currentCommentFiles);
      this.documents.set(currentDocuments);
    }
  }

  deleteFile(doc: Document) {
    if (doc && this.documents()) {
      const currentCommentFiles = this.commentFiles().filter(item => item.name !== doc.documentFileName);
      const currentDocuments = this.documents().filter(item => item.documentFileName !== doc.documentFileName);
      this.commentFiles.set(currentCommentFiles);
      this.documents.set(currentDocuments);
    }
  }

  learnMore() {
    this.hasSeenCAC.set(true);
    this.currentPage.set(2);
  }

  p1_next() {
    const proj = this.project();
    if (this.submittedCAC() || !proj?.projectCAC || !this.hasSeenCAC()) {
      this.currentPage.set(5);
    } else {
      this.currentPage.set(2);
    }
  }

  p2_back() {
    this.currentPage.update(page => page - 1);
  }

  p2_next() {
    // Skip
    this.currentPage.set(5);
  }

  p2_becomeAMember() {
    this.currentPage.update(page => page + 1);
  }

  p3_back() {
    this.currentPage.update(page => page - 1);
  }

  async p3_next() {
    // Submit CAC information
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
      const proj = this.project();
      if (proj) {
        const res = await this.projectService.cacSignUp(proj, signUpObject).toPromise();
        this.logger.info('CAC sign-up submitted successfully', 'AddCommentComponent');
        this.submitting.set(false);
        this.submittedCAC.set(true);
        this.currentPage.update(page => page + 1);
      }
    } catch (error) {
      this.logger.error('Error submitting CAC sign-up', 'AddCommentComponent', error);
      alert('Uh-oh, error submitting information');
      this.submitting.set(false);
    }
  }

  p4_next() {
    this.currentPage.update(page => page + 1);
  }

  p5_back() {
    this.currentPage.set(1);
  }

  async p5_next() {
    this.submitting.set(true);
    this.progressValue.set(0);
    this.progressBufferValue.set(0);

    // approximate size of everything for progress reporting
    const commentSize = this.sizeof(this.comment());
    this.totalSize.set(commentSize);

    let filesList: File[] = [];
    filesList = this.documents().map(item => item.upfile as File);

    let totalSizeCalc = commentSize;
    filesList.forEach(file => totalSizeCalc += file.size);
    this.totalSize.set(totalSizeCalc);

    // first add new comment
    this.progressBufferValue.set(100 * commentSize / totalSizeCalc);

    // Build the comment
    const currentComment = this.comment();
    currentComment.author = this.contactName();
    currentComment.comment = this.commentInput();
    currentComment.location = this.locationInput();
    currentComment.isAnonymous = !this.makePublic();
    currentComment.submittedCAC = this.submittedCAC();

    try {
      const savedComment = await this.commentService.add(currentComment).toPromise();
      if (!savedComment) throw new Error('Failed to save comment');
      
      this.progressValue.set(100 * commentSize / totalSizeCalc);
      this.comment.set(savedComment);

      // then upload all documents
      const observables: Array<Observable<Document>> = [];
      const proj = this.project();

      filesList.forEach(file => {
        const formData = new FormData();
        formData.append('_comment', savedComment._id);
        formData.append('displayName', file.name);
        formData.append('documentSource', 'COMMENT');
        formData.append('documentAuthor', savedComment.author);
        formData.append('documentAuthorType', this.documentAuthorType()?._id);
        if (proj) {
          formData.append('project', proj._id);
        }
        formData.append('documentFileName', file.name);
        formData.append('internalOriginalName', file.name);
        formData.append('documentSource', 'COMMENT');
        formData.append('dateUploaded', new Date().toISOString());
        formData.append('upfile', file);
        this.progressBufferValue.update(val => val + (100 * file.size / totalSizeCalc));

        observables.push(this.documentService.add(formData)
          .pipe(
            map((document: any) => {
              this.progressValue.update(val => val + (100 * file.size / totalSizeCalc));
              return document;
            })
          )
        );
      });

      // execute all uploads in parallel
      if (observables.length > 0) {
        await forkJoin(observables).toPromise();
      }

      this.submitting.set(false);
      this.currentPage.update(page => page + 1);
    } catch (error) {
      this.logger.error('Error submitting comment', 'AddCommentComponent', error);
      alert('Uh-oh, error submitting comment');
      this.submitting.set(false);
    }
  }

  // approximate size (keys + data)
  private sizeof(o: any): number {
    let bytes = 0;

    Object.keys(o).forEach(key => {
      bytes += key.length;
      const obj = o[key];
      switch (typeof obj) {
        case 'boolean': bytes += 4; break;
        case 'number': bytes += 8; break;
        case 'string': bytes += 2 * obj.length; break;
        case 'object': if (obj) { bytes += this.sizeof(obj); } break;
      }
    });
    return bytes;
  }

  private getLists() {
    this.config.lists.subscribe(lists => {
      lists.map((item: any) => {
        if (item.type === 'author' && item.name === 'Public') {
          this.documentAuthorType.set(Object.assign({}, item));
        }
      });
    });
  }
}
