import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
import { TagInputModule } from 'ngx-chips';
import { NgSelectModule } from '@ng-select/ng-select';

// Modules
import { SharedModule } from 'app/shared/shared.module';

// Components
import { ProjectsComponent } from './projects.component';
import { ProjlistListComponent } from './projlist-list/projlist-list.component';
import { ProjlistMapComponent } from './projlist-map/projlist-map.component';
import { ProjlistFiltersComponent } from './projlist-filters/projlist-filters.component';
import { ProjDetailPopupComponent } from './proj-detail-popup/proj-detail-popup.component';
import { ProjectListComponent } from './project-list/project-list.component';
import { ProjectListTableRowsComponent } from './project-list/project-list-table-rows/project-list-table-rows.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    RouterModule,
    TagInputModule,
    SharedModule,
    NgSelectModule
  ],
  declarations: [
    ProjectsComponent,
    ProjlistListComponent,
    ProjlistMapComponent,
    ProjlistFiltersComponent,
    ProjDetailPopupComponent,
    ProjectListComponent,
    ProjectListTableRowsComponent
  ],
  entryComponents: [
    ProjDetailPopupComponent,
    ProjectListTableRowsComponent
  ]
})

export class ProjectsModule { }
