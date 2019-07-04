import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProjectComponent } from './project.component';
import { ProjectResolver } from './project-resolver.service';
import { ProjectRoutes } from './project-routes';
import { CommentsComponent } from 'app/project/comments/comments.component';
import { CommentsResolver } from 'app/project/comments/comments-resolver.service';
import { DocumentsResolver } from './documents/documents-resolver.service';
import { ProjectActivitiesResolver } from './project-activites/project-activities-resolver.service';
import { CertificatesResolver } from './certificates/certificates-resolver.service';
import { AmendmentsResolverService } from './certificates/amendments-resolver.service';

const routes: Routes = [
  {
    path: 'p/:projId/cp/:commentPeriodId',
    redirectTo: 'p/:projId/cp/:commentPeriodId/details',
    pathMatch: 'full'
  },
  {
    path: 'p/:projId/cp/:commentPeriodId/details',
    component: CommentsComponent,
    resolve: {
      commentPeriod: CommentsResolver,
      project: ProjectResolver
    }
  },
  {
    path: 'p/:projId',
    component: ProjectComponent,
    resolve: {
      project: ProjectResolver
    },
    // each tab within the page navigates to a separate route
    // e.g. /project/:id/(project|comments|decisions)
    children: ProjectRoutes
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ],
  providers: [
    ProjectResolver,
    CommentsResolver,
    DocumentsResolver,
    CertificatesResolver,
    AmendmentsResolverService,
    ProjectActivitiesResolver
  ]
})

export class ProjectRoutingModule { }
