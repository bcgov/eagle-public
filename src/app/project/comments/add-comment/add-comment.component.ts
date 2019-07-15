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

@Component({
  templateUrl: './add-comment.component.html',
  styleUrls: ['./add-comment.component.scss']
})

export class AddCommentComponent implements OnInit {
  @Input() currentPeriod: CommentPeriod;
  @Input() project: Project;

  public submitting = false;
  private progressValue: number;
  private progressBufferValue: number;
  public totalSize: number;
  public currentPage = 1;
  private comment: Comment;
  public files: Array<File> = [];
  public documents: Document[] = [];
  public documentAuthor: any;

  public contactName: any;
  public commentInput: any;
  public locationInput: any;
  public makePublic: any;
  public commentFiles: any;

  constructor(
    public activeModal: NgbActiveModal,
    private commentService: CommentService,
    private documentService: DocumentService,
    private config: ConfigService,
  ) { }

  ngOnInit() {
    this.comment = new Comment();
    this.comment.period = this.currentPeriod._id;
    this.comment.isAnonymous = false;
    this.commentFiles = [];
    this.config.lists.map(item => {
      if (item.type === 'author' && item.name === 'Public') {
          this.documentAuthor = Object.assign({}, item);
      }
    });
  }

  register() {
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

  private p1_next() {
    this.currentPage++;
  }

  private p2_back() {
    this.currentPage--;
  }

  private p2_next() {
    this.submitting = true;
    this.progressValue = this.progressBufferValue = 0;

    // approximate size of everything for progress reporting
    const commentSize = this.sizeof(this.comment);
    this.totalSize = commentSize;

    const files = [];
    this.documents.map((item) => {
      console.log('upfile', item.upfile);
      files.push(item.upfile);
    });

    files.forEach(file => this.totalSize += file.size);

    // first add new comment
    this.progressBufferValue += 100 * commentSize / this.totalSize;

    // Build the comment
    this.comment.author = this.contactName;
    this.comment.comment = this.commentInput;
    this.comment.location = this.locationInput;
    this.comment.isAnonymous = !this.makePublic;

    this.commentService.add(this.comment)
      .toPromise()
      .then((comment: Comment) => {
        this.progressValue += 100 * commentSize / this.totalSize;
        this.comment = comment;
        return comment;
      })
      .then((comment: Comment) => {
        // then upload all documents
        const observables: Array<Observable<Document>> = [];

        files.forEach(file => {
          const formData = new FormData();
          formData.append('_comment', this.comment._id);
          formData.append('displayName', file.name);
          formData.append('documentSource', 'COMMENT');
          formData.append('documentAuthor', this.documentAuthor._id);
          formData.append('project', this.project._id);
          formData.append('documentFileName', file.name);
          formData.append('internalOriginalName', file.name);
          formData.append('documentSource', 'COMMENT');
          formData.append('dateUploaded', moment());
          formData.append('datePosted', moment());
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
            // .subscribe((event: HttpEventType) => {
            //   if (event.type === HttpEventType.UploadProgress) {
            //     // TODO: do something here
            //   }
            // })
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
}
