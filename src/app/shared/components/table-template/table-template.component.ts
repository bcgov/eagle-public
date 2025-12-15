import {
  Component,
  Input,
  OnDestroy,
  Output,
  EventEmitter,
  SimpleChanges,
  OnChanges,
  ChangeDetectionStrategy,
  effect,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPaginationModule } from 'ngx-pagination';

import { TableObject } from './table-object';
import { ITableMessage } from './table-row-component';
import { TableRowDirective } from './table-row.directive';
import { PageCountDisplayComponent } from '../page-count-display/page-count-display.component';
import { PageSizePickerComponent } from '../page-size-picker/page-size-picker.component';

@Component({
  selector: 'lib-table-template',
  templateUrl: './table-template.component.html',
  styleUrl: './table-template.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgxPaginationModule,
    PageSizePickerComponent,
    PageCountDisplayComponent,
    TableRowDirective
  ],
  standalone: true
})
export class TableTemplateComponent implements OnChanges, OnDestroy {
  @Input() data!: TableObject;

  @Input() messageIn: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();
  @Output() messageOut: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

  ngOnChanges(changes: SimpleChanges) {
    // only run when property "data" changed
    if (!changes['firstChange'] && changes['data'] && changes['data'].currentValue) {
      this.data.options = changes['data'].currentValue.options;
      this.data.items = changes['data'].currentValue.items;
      this.data.columns = changes['data'].currentValue.columns;
      this.data.dataset = changes['data'].currentValue.dataset;
      this.data.currentPage = changes['data'].currentValue.currentPage;
      this.data.pageSizeOptions = changes['data'].currentValue.pageSizeOptions;
      this.data.pageSize = changes['data'].currentValue.pageSize;
      this.data.sortBy = changes['data'].currentValue.sortBy;
      this.data.totalListItems = changes['data'].currentValue.totalListItems;

      this.setAllPicker();
    }
  }

  private setAllPicker() {
    if (this.data.options.showAllPicker) {
      this.data.pageSizeOptions = this.data.pageSizeOptions.filter(obj => {
        return obj.displayText !== 'Show All';
      });
      // Only show "Show All" if there are 500 or fewer items
      if (this.data.totalListItems <= 500) {
        this.data.pageSizeOptions.push({ displayText: 'Show All', value: this.data.totalListItems });
      }
    }
  }

  public onSort(property: string) {
    this.messageOut.emit({ label: 'columnSort', data: property });
  }

  onMessageOut(msg: ITableMessage) {
    this.messageOut.emit(msg);
  }

  onUpdatePageNumber(pageNum: number) {
    this.messageOut.emit({ label: 'pageNum', data: pageNum });
  }

  onUpdatePageSize(pageSize: any) {
    this.messageOut.emit({ label: 'pageSize', data: pageSize });
  }

  ngOnDestroy() { }
}
