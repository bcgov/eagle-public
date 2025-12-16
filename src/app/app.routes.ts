import { Routes } from '@angular/router';
import {
  projectResolver,
  commentPeriodResolver,
  projectNotificationResolver,
  newsResolver,
  projectListResolver,
  projectNotificationsResolver,
  searchResolver,
  documentsResolver,
  documentTableResolver,
  certificatesResolver,
  amendmentsResolver,
  applicationResolver,
  projectActivitiesResolver,
  pinsResolver,
  featuredDocumentsResolver
} from './resolvers';
import { HomeComponent } from './home/home.component';
import { ContactComponent } from './contact/contact.component';
import { LegislationComponent } from './legislation/legislation.component';
import { ProcessComponent } from './process/process.component';
import { ComplianceOversightComponent } from './compliance-oversight/compliance-oversight.component';
import { SearchHelpComponent } from './search-help/search-help.component';
import { CACUnsubscribeComponent } from './cac-unsubscribe/cac-unsubscribe.component';
import { NewsListComponent } from './news/news.component';
import { ProjectsComponent } from './projects/projects.component';
import { ProjectListComponent } from './projects/project-list/project-list.component';
import { ProjectNotificationsListComponent } from './project-notifications/project-notifications.component';
import { CommentsComponent } from './comments/comments.component';
import { SearchComponent } from './search/search.component';
import { ProjectComponent } from './project/project';
import { ProjectDetailsTabComponent } from './project/project-details-tab/project-details-tab.component';
import { CertificatesComponent } from './project/certificates/certificates.component';
import { AmendmentsComponent } from './project/amendments/amendments.component';
import { ApplicationComponent } from './project/application/application.component';
import { CommentingTabComponent } from './project/commenting-tab/commenting-tab.component';
import { DocumentsTabComponent } from './project/documents/documents-tab.component';
import { DecisionsTabComponent } from './project/decisions-tab/decisions-tab.component';

export const routes: Routes = [
  {
    path: 'contact',
    component: ContactComponent
  },
  
  {
    path: 'cac-unsubscribe',
    component: CACUnsubscribeComponent
  },
  
  {
    path: 'projects',
    component: ProjectsComponent
  },
  {
    path: 'projects-list',
    component: ProjectListComponent,
    resolve: {
      projectList: projectListResolver
    }
  },
  
  {
    path: 'project-notifications',
    component: ProjectNotificationsListComponent,
    resolve: {
      projectNotifications: projectNotificationsResolver
    }
  },
  
  {
    path: 'pn/:projId/cp/:commentPeriodId',
    redirectTo: 'pn/:projId/cp/:commentPeriodId/details',
    pathMatch: 'full'
  },
  {
    path: 'pn/:projId/cp/:commentPeriodId/details',
    component: CommentsComponent,
    resolve: {
      commentPeriod: commentPeriodResolver,
      project: projectNotificationResolver
    }
  },
  
  {
    path: 'news',
    component: NewsListComponent,
    resolve: {
      news: newsResolver
    }
  },
  
  {
    path: 'legislation',
    component: LegislationComponent
  },
  
  {
    path: 'compliance-oversight',
    component: ComplianceOversightComponent
  },
  
  {
    path: 'process',
    component: ProcessComponent
  },
  
  {
    path: 'search',
    component: SearchComponent,
    resolve: {
      documents: searchResolver,
      documentsTableRows: documentTableResolver
    }
  },
  
  {
    path: 'search-help',
    component: SearchHelpComponent
  },
  
  // Project comment period routes
  {
    path: 'p/:projId/cp/:commentPeriodId',
    redirectTo: 'p/:projId/cp/:commentPeriodId/details',
    pathMatch: 'full'
  },
  {
    path: 'p/:projId/cp/:commentPeriodId/details',
    component: CommentsComponent,
    resolve: {
      commentPeriod: commentPeriodResolver,
      project: projectResolver
    }
  },
  
  // Project detail routes with tabs
  {
    path: 'p/:projId',
    component: ProjectComponent,
    resolve: {
      project: projectResolver
    },
    children: [
      {
        path: '',
        redirectTo: 'project-details',
        pathMatch: 'full'
      },
      {
        path: 'project-details',
        component: ProjectDetailsTabComponent,
        resolve: {
          projectActivities: projectActivitiesResolver,
          pins: pinsResolver,
          featuredDocuments: featuredDocumentsResolver
        }
      },
      {
        path: 'certificates',
        component: CertificatesComponent,
        resolve: {
          certificates: certificatesResolver
        }
      },
      {
        path: 'amendments',
        component: AmendmentsComponent,
        resolve: {
          amendments: amendmentsResolver
        }
      },
      {
        path: 'application',
        component: ApplicationComponent,
        resolve: {
          application: applicationResolver
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
          documents: documentsResolver
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
    ]
  },
  
  {
    path: '',
    component: HomeComponent
  },
  
  // Wildcard route
  {
    path: '**',
    redirectTo: '/',
    pathMatch: 'full'
  }
];
