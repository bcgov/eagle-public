import { Routes } from '@angular/router';

import { CommentingTabComponent } from './commenting-tab/commenting-tab.component';
import { DecisionsTabComponent } from './decisions-tab/decisions-tab.component';
import { CommentsComponent } from './comments/comments.component';
import { DocumentsTabComponent } from './documents/documents-tab.component';
import { DocumentsResolver } from './documents/documents-resolver.service';
import { ProjectDetailsTabComponent } from './project-details-tab/project-details-tab.component';
import { ProjectActivitesComponent } from './project-activites/project-activites.component';
import { ProjectActivitiesResolver } from './project-activites/project-activities-resolver.service';
import { DocumentTableResolver } from './documents/project-document-table-rows/project-document-table-rows-resolver.service';
import { CertificatesResolver } from './certificates/certificates-resolver.service';
import { CertificatesComponent } from './certificates/certificates.component';
import { AmendmentsResolverService } from './certificates/amendments-resolver.service';
import { PinsComponent } from './pins/pins.component';
import { PinsResolverService } from './pins/pins-resolver.service';

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
      documents: ProjectActivitiesResolver
    }
  },
  {
    path: 'certificates',
    component: CertificatesComponent,
    resolve: {
      documents: CertificatesResolver
    }
  },
  {
    path: 'amendments',
    component: CertificatesComponent,
    resolve: {
      documents: AmendmentsResolverService
    }
  },
  {
    path: 'pins',
    component: PinsComponent,
    resolve: {
      pins: PinsResolverService
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
      documents: DocumentsResolver,
      documentsTableRow: DocumentTableResolver
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
