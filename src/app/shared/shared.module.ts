import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatProgressBarModule } from '@angular/material';
import { MatSnackBarModule } from '@angular/material';
import { NgxTextOverflowClampModule } from 'ngx-text-overflow-clamp';

import { OrderByPipe } from 'app/shared/pipes/order-by.pipe';
import { NewlinesPipe } from 'app/shared/pipes/newlines.pipe';
import { ObjectFilterPipe } from 'app/shared/pipes/object-filter.pipe';

import { VarDirective } from 'app/shared/utils/ng-var.directive';
import { DragMoveDirective } from 'app/shared/utils/drag-move.directive';

import { NgxPaginationModule } from 'ngx-pagination';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { ListConverterPipe } from './pipes/list-converter.pipe';
import { OrgNamePipe } from './pipes/org-name.pipe';
import { TableTemplateUtils } from './utils/table-template-utils';
import { TableDirective } from './components/table-template/table.directive';
import { PublishedPipe } from 'app/shared/pipes/published.pipe';
import { Utils } from './utils/utils';

@NgModule({
  imports: [
    BrowserModule,
    MatProgressBarModule,
    MatSnackBarModule,
    NgxTextOverflowClampModule,
    NgxPaginationModule
  ],
  declarations: [
    OrderByPipe,
    NewlinesPipe,
    ObjectFilterPipe,
    PublishedPipe,
    VarDirective,
    DragMoveDirective,
    TableTemplateComponent,
    TableDirective,
    ListConverterPipe,
    OrgNamePipe
  ],
  exports: [
    BrowserModule,
    MatProgressBarModule,
    MatSnackBarModule,
    NgxTextOverflowClampModule,
    OrderByPipe,
    NewlinesPipe,
    ObjectFilterPipe,
    PublishedPipe,
    VarDirective,
    DragMoveDirective,
    TableTemplateComponent,
    NgxPaginationModule,
    ListConverterPipe,
    OrgNamePipe
  ],
  providers: [
    TableTemplateUtils,
    Utils
  ]
})

export class SharedModule { }
