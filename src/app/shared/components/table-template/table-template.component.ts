import {
  Component,
  Input,
  OnDestroy,
  Output,
  EventEmitter,
  SimpleChanges,
  OnChanges,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPaginationModule } from 'ngx-pagination';

import { TableObject } from './table-object';
import { ITableMessage } from './table-row-component';
import { TableRowDirective } from './table-row.directive';
import { PageCountDisplayComponent } from '../page-count-display/page-count-display.component';
import { PageSizePickerComponent, IPageSizePickerOption } from '../page-size-picker/page-size-picker.component';
import { Constants } from '../../utils/constants';

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
  @Input() loading = false;

  @Input() messageIn: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();
  @Output() messageOut: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

  private lastTotalItems = 0;

  ngOnChanges(changes: SimpleChanges): void {
    const dataChange = changes['data'];
    if (!dataChange || dataChange.firstChange || !dataChange.currentValue) {
      return;
    }

    // Use Object.assign for efficient property copying
    const newData = dataChange.currentValue;
    Object.assign(this.data, {
      options: newData.options,
      items: newData.items,
      columns: newData.columns,
      dataset: newData.dataset,
      currentPage: newData.currentPage,
      pageSizeOptions: newData.pageSizeOptions,
      pageSize: newData.pageSize,
      sortBy: newData.sortBy,
      totalListItems: newData.totalListItems
    });

    // Only recalculate picker if total items changed
    if (this.data.totalListItems !== this.lastTotalItems) {
      this.setAllPicker();
      this.lastTotalItems = this.data.totalListItems;
    }
  }

  private setAllPicker(): void {
    if (!this.data.options.showAllPicker) {
      return;
    }

    // Filter out existing "Show All" option
    this.data.pageSizeOptions = this.data.pageSizeOptions.filter(obj => obj.displayText !== 'Show All');
    
    // Only show "Show All" if there are MAX_SHOW_ALL_ITEMS or fewer items
    if (this.data.totalListItems > 0 && this.data.totalListItems <= Constants.tableDefaults.MAX_SHOW_ALL_ITEMS) {
      this.data.pageSizeOptions.push({ displayText: 'Show All', value: this.data.totalListItems });
    }
  }

  public onSort(property: string): void {
    this.messageOut.emit({ label: 'columnSort', data: property });
  }

  public onMessageOut(msg: ITableMessage): void {
    this.messageOut.emit(msg);
  }

  public onUpdatePageNumber(pageNum: number): void {
    this.messageOut.emit({ label: 'pageNum', data: pageNum });
  }

  public onUpdatePageSize(pageSize: IPageSizePickerOption): void {
    this.messageOut.emit({ label: 'pageSize', data: pageSize });
  }

  public isSortedAsc(columnValue: string): boolean {
    return this.data.sortBy === `+${columnValue}`;
  }

  public isSortedDesc(columnValue: string): boolean {
    return this.data.sortBy === `-${columnValue}`;
  }

  public trackByRowId(index: number, item: any): any {
    return item.rowData?._id || index;
  }

  ngOnDestroy(): void { }
}
