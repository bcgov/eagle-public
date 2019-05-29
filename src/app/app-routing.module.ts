import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ContactComponent } from 'app/contact/contact.component';
import { ProjectsComponent } from 'app/projects/projects.component';
import { HomeComponent } from 'app/home/home.component';
import { ProjectListComponent } from './projects/project-list/project-list.component';
import { NewsListComponent } from './news/news.component';
import { LegislationComponent } from './legislation/legislation.component';
import { ProcessComponent } from './process/process.component';
import { ComplianceOversightComponent } from './compliance-oversight/compliance-oversight.component';
import { SearchHelpComponent } from './search-help/search-help.component';

const routes: Routes = [
  {
    path: 'contact',
    component: ContactComponent
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
  exports: [RouterModule]
})

export class AppRoutingModule { }
