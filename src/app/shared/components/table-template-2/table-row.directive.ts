import {
  Directive,
  ViewContainerRef,
  Input,
  ComponentFactoryResolver,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ComponentRef
} from '@angular/core';
import { IRowObject, TableObject2 } from './table-object-2';
import { TableRowComponent, ITableMessage } from './table-row-component';
import { InjectComponentService } from '../../services/inject-component.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Directive({
  selector: '[libTableRow]'
})
export class TableRowDirective implements OnInit, OnChanges, OnDestroy {
  @Input('libTableRow') rowObject: IRowObject;
  @Input() tableData: TableObject2;

  @Input() messageIn: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();
  @Output() messageOut: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();
  @Output() updateFavorites: EventEmitter<ITableMessage> = new EventEmitter<ITableMessage>();

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    public viewContainerRef: ViewContainerRef,
    public componentFactoryResolver: ComponentFactoryResolver,
    public injectComponentService: InjectComponentService
  ) {}

  ngOnInit() {
    this.loadComponent();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes.firstChange && changes['tableData'] && changes['tableData'].currentValue) {
      this.tableData = changes['tableData'].currentValue;
      this.rowObject = this.tableData.items.find(element => element.rowData._id === this.rowObject.rowData._id);

      this.loadComponent();
    }
  }

  /**
   * Inject the table row component.
   *
   * @memberof TableRowDirective
   */
  loadComponent() {
    const tableComponentRef: ComponentRef<TableRowComponent> = this.injectComponentService.injectComponentIntoView(
      this.viewContainerRef,
      this.rowObject.component || this.tableData.component
    );

    this.setRowComponentData(tableComponentRef.instance);
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

    // subscribe to the components updateFavorite events and forward them to table template
    componentInstance.updateFavorites.pipe(takeUntil(this.ngUnsubscribe)).subscribe(msg => {
      this.updateFavorites.emit(msg);
    });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
