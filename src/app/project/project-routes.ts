import { Routes } from '@angular/router';

import { CommentingTabComponent } from './commenting-tab/commenting-tab.component';
import { DecisionsTabComponent } from './decisions-tab/decisions-tab.component';
import { CommentsComponent } from 'app/comments/comments.component';
import { DocumentsTabComponent } from './documents/documents-tab.component';
import { DocumentsResolver } from './documents/documents-resolver.service';
import { ProjectDetailsTabComponent } from './project-details-tab/project-details-tab.component';
import { ProjectActivitiesResolver } from './project-activites/project-activities-resolver.service';
import { CertificatesResolver } from './certificates/certificates-resolver.service';
import { CertificatesComponent } from './certificates/certificates.component';
import { PinsResolverService } from './pins/pins-resolver.service';
import { FeaturedDocumentsResolverService } from './featured-documents/featured-documents-resolver.service';
import { ApplicationComponent } from './application/application.component';
import { ApplicationResolver } from './application/application-resolver.service';
import { AmendmentsComponent } from './amendments/amendments.component';
import { AmendmentsResolver } from './amendments/amendments-resolver.service';

export const ProjectRoutes: Routes = [
  {
    path: '',
    redirectTo: 'project-details',
    pathMatch: 'full'
  },
  {
    path: 'project-details',
    component: ProjectDetailsTabComponent,
    resolve: {
      ProjectActivitiesResolver,
      PinsResolverService,
      FeaturedDocumentsResolverService
    }
  },
  {
    path: 'certificates',
    component: CertificatesComponent,
    resolve: {
      CertificatesResolver,
    }
  },
  {
    path: 'amendments',
    component: AmendmentsComponent,
    resolve: {
      AmendmentsResolver,
    }
  },
  {
    path: 'application',
    component: ApplicationComponent,
    resolve: {
      ApplicationResolver
    }
  },
  {
    path: 'commenting',
    component: CommentingTabComponent
  },
  {
    path: 'documents',
    component: DocumentsTabComponent,
    resolve: {
      DocumentsResolver
    }
  },
  {
    path: 'decisions',
    component: DecisionsTabComponent
  },
  {
    path: 'cp',
    component: CommentsComponent
  }
];
