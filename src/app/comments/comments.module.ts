import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';

// modules
import { SharedModule } from 'app/shared/shared.module';
import { FileUploadComponent } from 'app/file-upload/file-upload.component';

// components
import { CommentsComponent } from './comments.component';
import { AddCommentComponent } from './add-comment/add-comment.component';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    RouterModule,
    SharedModule
  ],
  declarations: [
    FileUploadComponent,
    AddCommentComponent,
    CommentsComponent
  ],
  exports: [
    FileUploadComponent
  ],
  entryComponents: [
    AddCommentComponent
  ]
})
export class CommentsModule { }
