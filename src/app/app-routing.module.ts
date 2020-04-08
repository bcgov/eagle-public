import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ContactComponent } from 'app/contact/contact.component';
import { CACUnsubscribeComponent } from 'app/cac-unsubscribe/cac-unsubscribe.component';
import { ProjectsComponent } from 'app/projects/projects.component';
import { HomeComponent } from 'app/home/home.component';
import { ProjectListComponent } from './projects/project-list/project-list.component';
import { NewsListComponent } from './news/news.component';
import { LegislationComponent } from './legislation/legislation.component';
import { ProcessComponent } from './process/process.component';
import { ComplianceOversightComponent } from './compliance-oversight/compliance-oversight.component';
import { SearchHelpComponent } from './search-help/search-help.component';
import { NewsResolver } from './news/news-resolver.service';
import { ProjectNotificationsListComponent } from './project-notifications/project-notifications.component';
import { ProjectNotificationsResolver } from './project-notifications/project-notifications-resolver.service';
import { ProjectNotificationResolver } from './project-notifications/project-notification-resolver.service';
import { CommentsComponent } from 'app/comments/comments.component';
import { CommentsResolver } from 'app/comments/comments-resolver.service';
import { SearchComponent } from 'app/search/search.component';
import { SearchResolver } from './search/search-resolver.service';
import { DocumentTableResolver } from './project/documents/project-document-table-rows/project-document-table-rows-resolver.service';


const routes: Routes = [
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
    component: ProjectNotificationsListComponent,
    resolve: {
      projectNotifications: ProjectNotificationsResolver
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
      commentPeriod: CommentsResolver,
      project: ProjectNotificationResolver
    }
  },
  {
    path: 'news',
    component: NewsListComponent,
    resolve: {
      activities: NewsResolver
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
      documents: SearchResolver,
      documentsTableRows: DocumentTableResolver
    }
  },
  {
    path: 'search-help',
    component: SearchHelpComponent
  },
  {
    // default route
    path: '',
    component: HomeComponent
  },
  {
    // wildcard route
    path: '**',
    redirectTo: '/',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [NewsResolver, ProjectNotificationsResolver, ProjectNotificationResolver]
})

export class AppRoutingModule { }
