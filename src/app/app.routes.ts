import { Routes } from '@angular/router';
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
    component: ProjectListComponent
  },
  
  {
    path: 'project-notifications',
    component: ProjectNotificationsListComponent
  },
  
  {
    path: 'pn/:projId/cp/:commentPeriodId',
    redirectTo: 'pn/:projId/cp/:commentPeriodId/details',
    pathMatch: 'full'
  },
  {
    path: 'pn/:projId/cp/:commentPeriodId/details',
    component: CommentsComponent
  },
  
  {
    path: 'news',
    component: NewsListComponent
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
    component: SearchComponent
  },

  // Separate route, not a query parameter: each tab has to be linkable, and TableListComponent
  // reads its config once on init, so the router must build a new instance per tab.
  {
    path: 'search/content',
    component: SearchComponent,
    data: { content: true }
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
    component: CommentsComponent
  },
  
  // Project detail routes with tabs
  {
    path: 'p/:projId',
    component: ProjectComponent,
    children: [
      {
        path: '',
        redirectTo: 'project-details',
        pathMatch: 'full'
      },
      {
        path: 'project-details',
        component: ProjectDetailsTabComponent
      },
      {
        path: 'certificates',
        component: CertificatesComponent
      },
      {
        path: 'amendments',
        component: AmendmentsComponent
      },
      {
        path: 'application',
        component: ApplicationComponent
      },
      {
        path: 'commenting',
        component: CommentingTabComponent
      },
      {
        path: 'documents',
        component: DocumentsTabComponent
      },
      {
        path: 'decisions',
        component: DecisionsTabComponent
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
