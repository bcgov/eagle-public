import {
  Component,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  OnChanges,
  ChangeDetectionStrategy,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { TableObject } from './table-object';
import { ITableMessage } from './table-row-component';
import { TableRowDirective } from './table-row.directive';
import { PageCountDisplayComponent } from '../page-count-display/page-count-display.component';
import { PageSizePickerComponent, IPageSizePickerOption } from '../page-size-picker/page-size-picker.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { Constants } from '../../utils/constants';

@Component({
  selector: 'lib-table-template',
  templateUrl: './table-template.component.html',
  styleUrl: './table-template.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    PageSizePickerComponent,
    PageCountDisplayComponent,
    PaginationComponent,
    TableRowDirective
  ],
  standalone: true
})
export class TableTemplateComponent implements OnChanges {
  @Input() data!: TableObject;
  @Input() loading = false;

  @Input() messageIn: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();
  @Output() messageOut: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

  private lastTotalItems = 0;
  
  // Create a signal to track data changes for computed signals
  private dataSignal = signal<TableObject | undefined>(undefined);

  /**
   * Computed signal for total number of pages
   */
  protected totalPages = computed(() => {
    const data = this.dataSignal();
    const total = data?.totalListItems || 0;
    const size = data?.pageSize || 10;
    return Math.ceil(total / size);
  });

  /**
   * Computed signal to determine if pagination should be displayed
   */
  protected shouldShowPagination = computed(() => {
    const data = this.dataSignal();
    return data?.options?.showPagination && this.totalPages() > 1;
  });

  /**
   * Computed signal for paginated items (slices array for current page)
   */
  protected paginatedItems = computed(() => {
    const data = this.dataSignal();
    // Items are already paginated from the server, just return them
    return data?.items || [];
  });

  ngOnChanges(changes: SimpleChanges): void {
    const dataChange = changes['data'];
    if (!dataChange || !dataChange.currentValue) {
      return;
    }

    // Handle first change - just set the signal
    if (dataChange.firstChange) {
      this.dataSignal.set(dataChange.currentValue);
      this.lastTotalItems = this.data.totalListItems;
      this.setAllPicker();
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
    
    // Update signal to trigger computed signals
    this.dataSignal.set(this.data);

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
}
