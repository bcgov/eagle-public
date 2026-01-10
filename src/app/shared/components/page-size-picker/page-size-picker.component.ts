/**
 * Defines a single page size option.
 *
 * @export
 * @interface pageSizePickerOption
 */
export interface IPageSizePickerOption {
  /**
   * Text to display in the UI.
   *
   * @type {string}
   * @memberof pageSizePickerOption
   */
  displayText?: string;
  /**
   * Page size.
   *
   * @type {number}
   * @memberof pageSizePickerOption
   */
  value: number;
}

import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-page-size-picker',
  templateUrl: './page-size-picker.component.html',
  styleUrls: ['./page-size-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true
})
export class PageSizePickerComponent {
  isDisabled = input(false);
  isHidden = input(false);
  sizeOptions = input<IPageSizePickerOption[]>([]);
  currentPageSize = input<number>();

  pageSizeChosen = output<IPageSizePickerOption>();

  getTitle(sizeOption: IPageSizePickerOption) {
    return `Show ${sizeOption.value} records per page`;
  }

  sizeOptionChosen(sizeOption: IPageSizePickerOption) {
    this.pageSizeChosen.emit(sizeOption);
  }

  isSizeOptionActive(sizeOption: IPageSizePickerOption): boolean {
    return sizeOption.value === this.currentPageSize();
  }
}
