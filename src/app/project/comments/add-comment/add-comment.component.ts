import { Component, Input, OnInit } from '@angular/core';
// import { HttpEventType } from '@angular/common/http';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/observable/forkJoin';

import { Comment } from 'app/models/comment';
import { Document } from 'app/models/document';
import { CommentPeriod } from 'app/models/commentperiod';
import { CommentService } from 'app/services/comment.service';
import { DocumentService } from 'app/services/document.service';
import * as moment from 'moment-timezone';
import { Project } from 'app/models/project';
import { ConfigService } from 'app/services/config.service';
import { ProjectService } from 'app/services/project.service';

@Component({
  templateUrl: './add-comment.component.html',
  styleUrls: ['./add-comment.component.scss']
})

export class AddCommentComponent implements OnInit {
  @Input() currentPeriod: CommentPeriod;
  @Input() project: Project;

  public submitting = false;
  public progressValue: number;
  public progressBufferValue: number;
  public totalSize: number;
  public currentPage = 1;
  public comment: Comment;
  public files: Array<File> = [];
  public documents: Document[] = [];
  public documentAuthor: any;
  public documentAuthorType: any;
  public contactName: string;
  public commentInput: any;
  public locationInput: any;
  public makePublic: any;
  public commentFiles: any;
  public anonymousName = 'Anonymous';

  // CAC
  public nameInput: any;
  public emailInput: any;
  public liveNear: boolean;
  public liveNearInput: any;
  public memberOf: boolean;
  public memberOfInput: any;
  public knowledgeOf: boolean;
  public knowledgeOfInput: any;
  public additionalNotesInput: any;
  public submittedCAC: Boolean;
  public hasSeenCAC: Boolean;

  constructor(
    public activeModal: NgbActiveModal,
    private commentService: CommentService,
    private projectService: ProjectService,
    private documentService: DocumentService,
    private config: ConfigService,
  ) { }

  ngOnInit() {
    this.hasSeenCAC = false;
    this.comment = new Comment();
    this.contactName = this.anonymousName;
    this.comment.period = this.currentPeriod._id;
    this.comment.isAnonymous = true;
    this.submittedCAC = false;
    this.commentFiles = [];
    this.documentAuthorType = null;
    this.getLists();
  }
  public publicChecked() {
      this.contactName = this.makePublic ? '' : this.anonymousName;
  }
  public addFiles(files: FileList) {
    if (files) { // safety check
      for (let i = 0; i < files.length; i++) {
        if (files[i]) {
          // ensure file is not already in the list
          if (this.documents.find(x => x.documentFileName === files[i].name)) {
            continue;
          }
          this.commentFiles.push(files[i]);
          const document = new Document();
          document.upfile = files[i];
          document.documentFileName = files[i].name;
          document.internalOriginalName = files[i].name;
          // save document for upload to db when project is added or saved
          this.documents.push(document);
        }
      }
    }
  }

  public deleteFile(doc: Document) {
    if (doc && this.documents) { // safety check
      // remove doc from current list
      this.commentFiles = this.commentFiles.filter(item => (item.name !== doc.documentFileName));
      this.documents = this.documents.filter(item => (item.documentFileName !== doc.documentFileName));
    }
  }

  public learnMore() {
    this.hasSeenCAC = true;
    this.currentPage = 2;
  }

  public p1_next() {
    if (this.submittedCAC || !this.project.projectCAC || !this.hasSeenCAC) {
      this.currentPage += 4;
    } else {
      this.currentPage++;
    }
  }

  public p2_back() {
    this.currentPage--;
  }

  public p2_next() {
    // Skip
    this.currentPage += 3;
  };

  public p2_becomeAMember() {
    this.currentPage++;
  }

  public p3_back() {
    this.currentPage--;
  }

  public p3_next() {
    // Submit CAC information
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
      this.submittedCAC = true;
      this.currentPage++;
    })
    .catch(error => {
      console.log('error', error);
      alert('Uh-oh, error submitting information');
      this.submitting = false;
    });
  }

  public p4_next() {
    this.currentPage++;
  }

  public p5_back() {
    this.currentPage -= 4;
  }

  // TODO: Have some null checks in here from the front end
  public p5_next() {
    this.submitting = true;
    this.progressValue = this.progressBufferValue = 0;

    // approximate size of everything for progress reporting
    const commentSize = this.sizeof(this.comment);
    this.totalSize = commentSize;

    let files = [];
    files = this.documents.map((item) => {
      console.log('upfile', item.upfile);
      return item.upfile;
    });

    files.forEach(file => this.totalSize += file.size);

    // first add new comment
    this.progressBufferValue += 100 * commentSize / this.totalSize;

    // Build the comment
    this.comment.author = this.contactName;
    this.comment.comment = this.commentInput;
    this.comment.location = this.locationInput;
    this.comment.isAnonymous = !this.makePublic;
    this.comment.submittedCAC = this.submittedCAC;

    this.commentService.add(this.comment)
      .toPromise()
      .then((comment: Comment) => {
        this.progressValue += 100 * commentSize / this.totalSize;
        this.comment = comment;
        return comment;
      })
      .then(() => {
        // then upload all documents
        const observables: Array<Observable<Document>> = [];

        files.forEach(file => {
          const formData = new FormData();
          formData.append('_comment', this.comment._id);
          formData.append('displayName', file.name);
          formData.append('documentSource', 'COMMENT');
          formData.append('documentAuthor', this.comment.author);
          formData.append('documentAuthorType', this.documentAuthorType._id);
          formData.append('project', this.project._id);
          formData.append('documentFileName', file.name);
          formData.append('internalOriginalName', file.name);
          formData.append('documentSource', 'COMMENT');
          formData.append('dateUploaded', moment());
          // formData.append('datePosted', moment());
          formData.append('upfile', file);
          this.progressBufferValue += 100 * file.size / this.totalSize;

          // TODO: improve progress bar by listening to progress events
          // see https://stackoverflow.com/questions/37158928/angular-2-http-progress-bar
          // see https://angular.io/guide/http#listening-to-progress-events
          observables.push(this.documentService.add(formData)
            .map((document: Document) => {
              this.progressValue += 100 * file.size / this.totalSize;
              return document;
            })
          );
        });

        // execute all uploads in parallel
        return Observable.forkJoin(observables).toPromise();
      })
      .then(() => {
        this.submitting = false;
        this.currentPage++;
      })
      .catch(error => {
        console.log('error', error);
        alert('Uh-oh, error submitting comment');
        this.submitting = false;
      });
  }

  // approximate size (keys + data)
  private sizeof(o: object) {
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
    this.config.lists.subscribe (lists => {
      lists.map(item => {
        if (item.type === 'author' && item.name === 'Public') {
          this.documentAuthorType = Object.assign({}, item);
        }
      });
    });
  }
}
