import {
  Directive,
  ViewContainerRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  inject
} from '@angular/core';
import { IRowObject, TableObject } from './table-object';
import { TableRowComponent, ITableMessage } from './table-row-component';
import { InjectComponentService } from '../../services/inject-component.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Directive({
  selector: '[libTableRow]',
  standalone: true
})
export class TableRowDirective implements OnInit, OnChanges, OnDestroy {
  @Input('libTableRow') rowObject!: IRowObject;
  @Input() tableData!: TableObject;

  @Input() messageIn: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();
  @Output() messageOut: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  
  private viewContainerRef = inject(ViewContainerRef);
  private injectComponentService = inject(InjectComponentService);

  ngOnInit() {
    this.loadComponent();
  }

  ngOnChanges(changes: SimpleChanges) {
    const tableDataChange = changes['tableData'];
    if (tableDataChange?.firstChange || !tableDataChange?.currentValue) {
      return;
    }

    this.tableData = tableDataChange.currentValue;
    
    // Find updated row data - the items array contains only current page items
    const updatedRow = this.tableData.items.find(element => element.rowData._id === this.rowObject.rowData._id);
    if (updatedRow) {
      this.rowObject = updatedRow;
    }
    
    // Always reload component when table data changes (pagination, sorting, etc.)
    this.loadComponent();
  }

  /**
   * Inject the table row component.
   *
   * @memberof TableRowDirective
   */
  loadComponent() {
    const component = this.rowObject.component || this.tableData.component;
    if (!component) {
      return;
    }
    
    this.viewContainerRef.clear();
    const componentRef = this.injectComponentService.injectComponentIntoView(
      this.viewContainerRef,
      component
    );

    this.setRowComponentData(componentRef.instance);
  }

  /**
   * Set the table row component data and outbound/inbound event handlers.
   *
   * @param {TableRowComponent} componentInstance
   * @memberof TableRowDirective
   */
  setRowComponentData(componentInstance: TableRowComponent) {
    componentInstance.rowData = this.rowObject.rowData;
    componentInstance.tableData = this.tableData;

    // subscribe to the components outbound messages and forward them to table template
    componentInstance.messageOut.pipe(takeUntil(this.ngUnsubscribe)).subscribe(msg => {
      this.messageOut.emit(msg);
    });

    // subscribe to table templates inbound messages and forward them to row component
    this.messageIn.pipe(takeUntil(this.ngUnsubscribe)).subscribe(msg => {
      componentInstance.messageIn.emit(msg);
    });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
