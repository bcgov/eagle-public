import { NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BrowserModule } from '@angular/platform-browser';
import { MatAutocompleteModule, MatCheckboxModule, MatChipsModule, MatIconModule, MatProgressBarModule, MatSelectModule, MatSlideToggleModule, MatTooltipModule } from '@angular/material';
import { MatSnackBarModule } from '@angular/material';
import { NgxTextOverflowClampModule } from 'ngx-text-overflow-clamp';

import { OrderByPipe } from 'app/shared/pipes/order-by.pipe';
import { NewlinesPipe } from 'app/shared/pipes/newlines.pipe';
import { ObjectFilterPipe } from 'app/shared/pipes/object-filter.pipe';

import { VarDirective } from 'app/shared/utils/ng-var.directive';
import { DragMoveDirective } from 'app/shared/utils/drag-move.directive';

import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { ListConverterPipe } from './pipes/list-converter.pipe';
import { SafeHtmlPipe } from './pipes/safe-html-converter.pipe';
import { OrgNamePipe } from './pipes/org-name.pipe';
import { TableTemplateUtils } from './utils/table-template-utils';
import { TableDirective } from './components/table-template/table.directive';
import { TableTemplateModule } from './components/table-template/table-template.modules'
import { PublishedPipe } from 'app/shared/pipes/published.pipe';
import { Utils } from './utils/utils';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgZorroAntdModule, NZ_I18N, en_US } from 'ng-zorro-antd';
import { NgSelectModule } from '@ng-select/ng-select';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgxPaginationModule } from 'ngx-pagination';
import { TableRowDirective } from './components/table-template-2/table-row.directive';
import { TableTemplate2Component } from './components/table-template-2/table-template-2.component';
import { PageSizePickerComponent } from './components/page-size-picker/page-size-picker.component';
import { PageCountDisplayComponent } from './components/page-count-display/page-count-display.component';
import { InjectComponentService } from './services/inject-component.service';
import { TableTemplate } from './components/table-template-2/table-template';
import { AutoCompleteMultiSelectComponent } from './components/autocomplete-multi-select/autocomplete-multi-select.component';
import { SearchFilterTemplateComponent } from './components/search-filter-template/search-filter-template.component';
import { CallbackPipe } from './components/autocomplete-multi-select/callback.pipe';
import { DatePickerComponent } from './components/date-picker/date-picker.component';
import { AutoCompleteMultiSelect2Component } from './components/autocomplete-multi-select-2/autocomplete-multi-select-2.component';

@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    NgSelectModule,
    MatProgressBarModule,
    MatSnackBarModule,
    NgxTextOverflowClampModule,
    BrowserAnimationsModule,
    NgZorroAntdModule,
    TableTemplateModule,
    RouterModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    ReactiveFormsModule,
    NgbModule,
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
    SafeHtmlPipe,
    OrgNamePipe,
    CallbackPipe,

    TableRowDirective,
    TableTemplate2Component,
    PageSizePickerComponent,
    PageCountDisplayComponent,
    AutoCompleteMultiSelectComponent,
    AutoCompleteMultiSelect2Component,
    SearchFilterTemplateComponent,
    DatePickerComponent
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
    ListConverterPipe,
    SafeHtmlPipe,
    OrgNamePipe,
    CallbackPipe,

    TableRowDirective,
    TableTemplate2Component,
    PageSizePickerComponent,
    PageCountDisplayComponent,
    AutoCompleteMultiSelectComponent,
    AutoCompleteMultiSelect2Component,
    SearchFilterTemplateComponent,
    DatePickerComponent
  ],
  providers: [
    TableTemplateUtils,
    TableTemplate,
    Utils,
    InjectComponentService,
    { provide: NZ_I18N, useValue: en_US }
  ]
})

export class SharedModule { }
