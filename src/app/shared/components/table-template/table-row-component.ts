import { TableObject } from './table-object';
import { EventEmitter } from '@angular/core';

/**
 * Generic message event for all input/output messages.
 *
 * @export
 * @interface ITableMessage
 */
export interface ITableMessage {
  /**
   * Label to identify this event.
   *
   * @type {string}
   * @memberof ITableMessage
   */
  label: string;
  /**
   * Any data that should be sent with the event.
   *
   * @type {*}
   * @memberof ITableMessage
   */
  data?: any;
}

/**
 * Interface for components compatible with table template.
 * Components should implement this interface and use @Input/@Output decorators or input()/output() functions.
 *
 * @export
 * @interface TableRowComponent
 */
export interface TableRowComponent {
  /**
   * The specific row data used by the component.
   *
   * @type {*}
   * @memberof TableRowComponent
   */
  rowData: any;
  /**
   * A copy of the table data.
   *
   * @type {TableObject}
   * @memberof TableRowComponent
   */
  tableData: TableObject;
  /**
   * An output for generically emitting events from child to parent.
   *
   * @type {EventEmitter<ITableMessage>}
   * @memberof TableRowComponent
   */
  messageOut: EventEmitter<ITableMessage>;

  /**
   * An input for generically emitting events from parent to child.
   *
   * @type {EventEmitter<ITableMessage>}
   * @memberof TableRowComponent
   */
  messageIn: EventEmitter<ITableMessage>;
}
