import { NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TagInputModule } from 'ngx-chips';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    NgbModule,
    RouterModule,
    TagInputModule,
    NgbModule
  ],
  declarations: [
  ],
  entryComponents: [
  ]
})

export class TableTemplateModule { }
