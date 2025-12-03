import { NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BrowserModule } from '@angular/platform-browser';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { OrderByPipe } from 'app/shared/pipes/order-by.pipe';
import { NewlinesPipe } from 'app/shared/pipes/newlines.pipe';
import { ObjectFilterPipe } from 'app/shared/pipes/object-filter.pipe';

import { VarDirective } from 'app/shared/utils/ng-var.directive';
import { DragMoveDirective } from 'app/shared/utils/drag-move.directive';

import { ListConverterPipe } from './pipes/list-converter.pipe';
import { SafeHtmlPipe } from './pipes/safe-html-converter.pipe';
import { OrgNamePipe } from './pipes/org-name.pipe';
import { PublishedPipe } from 'app/shared/pipes/published.pipe';
import { Utils } from './utils/utils';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgSelectModule } from '@ng-select/ng-select';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgxPaginationModule } from 'ngx-pagination';
import { TableRowDirective } from './components/table-template/table-row.directive';
import { TableTemplateComponent } from './components/table-template/table-template.component';
import { PageSizePickerComponent } from './components/page-size-picker/page-size-picker.component';
import { PageCountDisplayComponent } from './components/page-count-display/page-count-display.component';
import { InjectComponentService } from './services/inject-component.service';
import { TableTemplate } from './components/table-template/table-template';
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
    BrowserAnimationsModule,
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
    ListConverterPipe,
    SafeHtmlPipe,
    OrgNamePipe,
    CallbackPipe,

    TableRowDirective,
    TableTemplateComponent,
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
    NgxPaginationModule,
    OrderByPipe,
    NewlinesPipe,
    ObjectFilterPipe,
    PublishedPipe,
    VarDirective,
    DragMoveDirective,
    ListConverterPipe,
    SafeHtmlPipe,
    OrgNamePipe,
    CallbackPipe,

    TableRowDirective,
    TableTemplateComponent,
    PageSizePickerComponent,
    PageCountDisplayComponent,
    AutoCompleteMultiSelectComponent,
    AutoCompleteMultiSelect2Component,
    SearchFilterTemplateComponent,
    DatePickerComponent
  ],
  providers: [
    TableTemplate,
    Utils,
    InjectComponentService
  ]
})

export class SharedModule { }
