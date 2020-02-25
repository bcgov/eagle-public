import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
import { TagInputModule } from 'ngx-chips';

// modules
import { SharedModule } from 'app/shared/shared.module';
import { ProjectRoutingModule } from './project-routing.module';
import { CommentsModule } from 'app/project/comments/comments.module';

// components
import { ProjectComponent } from './project.component';
import { CommentingTabComponent } from './commenting-tab/commenting-tab.component';
import { DecisionsTabComponent } from './decisions-tab/decisions-tab.component';
import { DateInputComponent } from 'app/date-input/date-input.component';
import { DocumentsTabComponent } from './documents/documents-tab.component';
import { DocumentTableRowsComponent } from 'app/project/documents/project-document-table-rows/project-document-table-rows.component';
import { DocumentDetailComponent } from 'app/project/documents/detail/detail.component';
import { ToggleButtonComponent } from 'app/project/toggle-button/toggle-button.component';
import { DetailsSidebarComponent } from 'app/project/details-sidebar/details-sidebar.component';

import { StorageService } from 'app/services/storage.service';
import { ProjectDetailsTabComponent } from './project-details-tab/project-details-tab.component';
import { CommentsTableRowsComponent } from 'app/project/comments/comments-table-rows/comments-table-rows.component';
import { ProjectActivitesComponent } from './project-activites/project-activites.component';
import { CertificatesComponent } from './certificates/certificates.component';
import { PinsComponent } from './pins/pins.component';
import { PinsTableRowsComponent } from './pins/pins-table-rows/pins-table-rows.component';

import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    NgbModule.forRoot(),
    RouterModule,
    TagInputModule,
    SharedModule,
    CommentsModule,
    ProjectRoutingModule,
    NgSelectModule,
    FormsModule
  ],
  declarations: [
    ProjectComponent,
    CommentingTabComponent,
    DecisionsTabComponent,
    DocumentDetailComponent,
    DateInputComponent,
    DocumentsTabComponent,
    DocumentTableRowsComponent,
    PinsTableRowsComponent,
    CommentsTableRowsComponent,
    ProjectDetailsTabComponent,
    ProjectActivitesComponent,
    CertificatesComponent,
    PinsComponent,
    ToggleButtonComponent,
    DetailsSidebarComponent,
  ],
  providers: [
    StorageService
  ],
  entryComponents: [
    DocumentTableRowsComponent,
    PinsTableRowsComponent,
    CommentsTableRowsComponent
  ]
})

export class ProjectModule { }
