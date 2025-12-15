import {
  Component,
  input,
  ViewChild,
  ElementRef,
  OnInit,
  ChangeDetectorRef,
  inject,
  OnDestroy,
  output,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface IMutliSelectOption {
  /**
   * Value set on the control when an option is selected.
   *
   * @type {string}
   * @memberof IMutliSelectOption
   */
  value: string;
  /**
   * The value displayed in the UI.
   *
   * @type {string}
   * @memberof IMutliSelectOption
   */
  displayValue: string;
  /**
   * True if the value is selected, false otherwise.
   *
   * @type {boolean}
   * @memberof IMutliSelectOption
   */
  selected: boolean;
  /**
   * Whether or not to show this item in the list (re: filtering).
   *
   * @type {boolean}
   * @memberof IMutliSelectOption
   */
  display: boolean;
}

@Component({
  selector: 'app-autocomplete-multi-select',
  templateUrl: './autocomplete-multi-select.component.html',
  styleUrls: ['./autocomplete-multi-select.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule
  ]
})
export class AutoCompleteMultiSelectComponent implements OnInit, OnDestroy {
  private _changeDetectionRef = inject(ChangeDetectorRef);

  control = input.required<FormControl | null>();
  options = input.required<IMutliSelectOption[]>();
  reset = input<Subject<any> | null>(null);
  placeholderText = input('Begin typing to filter...');
  useChips = input(false);

  numSelected = output<number>();

  // reference to the <input> element
  @ViewChild('multiAutocompleteFilter', { read: ElementRef, static: false }) 
  multiAutocompleteFilter!: ElementRef<HTMLInputElement>;
  
  @ViewChild(MatAutocompleteTrigger, {static: false}) 
  trigger!: MatAutocompleteTrigger;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public updatedPaceholderText = signal('');
  public currentOptions = signal<IMutliSelectOption[]>([]);

  constructor() {
    effect(() => {
      this.updatedPaceholderText.set(this.placeholderText());
      this.currentOptions.set(this.options());
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.initializeFormControlValue();

    const resetValue = this.reset();
    if (resetValue) {
      resetValue.pipe(takeUntil(this.ngUnsubscribe)).subscribe(() => this.resetComponent());
    }

    this.updatePlaceholderTextValue();
    this._changeDetectionRef.detectChanges();
  }

  public initializeFormControlValue() {
    const controlValue = this.control();
    if (!controlValue?.value) {
      // no initial state to set
      this.currentOptions.set(this.currentOptions().map(agency => {
        agency.selected = false;
        return agency;
      }));
      return;
    }

    // Populate options initial selected state
    const valuesToSelect = controlValue.value.split(',');
    this.currentOptions.set(this.currentOptions().map(option => {
      if (valuesToSelect.includes(option.value)) {
        option.selected = true;
      }
      return option;
    }));

    // emit number of selected filters
    this.numSelected.emit(this.getSelectedValues().length);
  }

  /**
   * When typing in the input field, filter picklist options.
   *
   * @param {*} event
   * @returns
   * @memberof AutoCompleteMultiSelectComponent
   */
  public filterPicklist(event: any) {
    if (event.keyCode === 13) {
      // ENTER key handled on keyup
      return;
    }

    this.currentOptions.set(this.getOptionsFromKeywords(event.target.value));
  }

  /**
   * Handle the case where the user has selected an option using the keyboard and enter key.
   *
   * Why? Some unique considerations that aren't an issue when using the mouse to select options.
   *
   * @param {*} event
   * @memberof AutoCompleteMultiSelectComponent
   */
  public handleEnter(event: any) {
    if (event.keyCode === 13) {
      // Default behaviour is to click the first button in the form, which is not applicable as we don't have a 'submit'
      // button to target.  Searches happen automatically as filters are selected.
      event.preventDefault();

      // Can't seem to assign the IMultiSelectOption object as the mat-option value, so reconstruct it here to pass on.
      // This is only a problem when selecting an option using the keyboard (enter).

      // Select the top option as the closest match
      // But only handle if it isn't selected, otherwise it will be toggled off?
      // ignore the process if the user hits enter without actually typing anything
      if (event.target.value.length > 0) {
        if (event.target.value !== 'Clear Selected') {
          const topOption = this.getOptionsFromKeywords(event.target.value).find(op => op.display && !op.selected);

          if (topOption) {
            const option: IMutliSelectOption = {
              value: topOption.value,
              displayValue: topOption.displayValue,
              selected: false,
              display: true
            };

            this.toggleSelection(option);
          }
        } else {
          this.selectNone();
        }
      }

      // clear the input field, as selected options shouldn't be displayed there
      this.multiAutocompleteFilter.nativeElement.value = '';
      // reset the selected options list
      this.currentOptions.set(this.getOptionsFromKeywords(''));
    }
  }

  /**
   * Toggles the 'selected' param of an option
   *
   * @param {IMutliSelectOption} option
   * @memberof AutoCompleteMultiSelectComponent
   */
  public toggleSelection(option: IMutliSelectOption) {
    this.currentOptions.set(this.currentOptions().map(agency => {
      if (agency.value === option.value) {
        agency.selected = !agency.selected;
      }
      return agency;
    }));

    this.setFormControlValue();
    this.updatePlaceholderTextValue();
    this._changeDetectionRef.detectChanges();
  }

  public updatePlaceholderTextValue() {
    // update the placeholder text
    if (!this.useChips() && this.currentOptions().filter(op => op.selected).length > 0) {
      let newPlaceholder = '';
      for (const displayedOption of this.currentOptions().filter(op => op.selected)) {
        newPlaceholder += displayedOption.displayValue + ', ';
      }
      this.updatedPaceholderText.set(newPlaceholder.slice(0, -2));
    } else {
      this.updatedPaceholderText.set(this.placeholderText());
    }
  }

  /**
   * Un-selects all options.
   *
   * @memberof AutoCompleteMultiSelectComponent
   */
  public selectNone() {
    this.currentOptions.set(this.currentOptions().map(agency => {
      agency.selected = false;
      return agency;
    }));

    this.currentOptions.set(this.getOptionsFromKeywords(''));
    this.setFormControlValue();
    this.updatePlaceholderTextValue();
    this._changeDetectionRef.detectChanges();

    // Component onFocus can sometimes not trigger the panel
    // so this should force it open when a user clicks 'clear selected'
    if (this.trigger) {
      this.trigger._onChange('');
      this.trigger.openPanel();
    }
  }

  /**
   * Given a space delimited string of keywords, return all options that contain one or more of the keywords.
   *
   * Note: case insensitive.
   *
   * @param {string} keywordString space delimited string of keywords
   * @returns {string[]} array of agencies
   * @memberof AutoCompleteMultiSelectComponent
   */
  public getOptionsFromKeywords(keywordString: string): IMutliSelectOption[] {
    if (!keywordString) {
      // if no keyword filters, return all options
      return this.currentOptions().map(option => {
        option.display = true;
        return option;
      });
    }

    // tokenize keyword string (spaces, commas, semi-colons) and remove any empty tokens
    const keywords = keywordString
      .split(/[\s,;]+/)
      .filter(keyword => keyword)
      .map(keyword => keyword.toLowerCase());

    // filter the list of options against the list of keywords
    return this.currentOptions().map(option => {
      option.display = keywords.every(keyword => option.value.toLowerCase().includes(keyword));
      return option;
    });
  }

  public getSelectedValues(): string[] {
    return this.currentOptions().filter(option => option.selected).map(option => option.value);
  }

  /**
   * Parses the selected options into an array of strings and assigns it to the form control value.
   *
   * @memberof AutoCompleteMultiSelectComponent
   */
  public setFormControlValue() {
    const selectedOptionValues: string[] = this.getSelectedValues();

    // emit number of selected filters
    this.numSelected.emit(selectedOptionValues.length);

    const controlValue = this.control();
    if (!selectedOptionValues || !selectedOptionValues.length) {
      controlValue?.reset();
      return;
    }

    controlValue?.setValue(selectedOptionValues);
  }

  /**
   * Resets this component to its default unset state.
   *
   * @memberof AutoCompleteMultiSelectComponent
   */
  public resetComponent() {
    this.control()?.reset();

    this.currentOptions.set(this.currentOptions().map(option => {
      option.selected = false;
      return option;
    }));

    this.numSelected.emit(0);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }

  removeChip(option: IMutliSelectOption) {
    option.selected = false;
    this.setFormControlValue();
    this.multiAutocompleteFilter.nativeElement.value = '';
    // reset the selected options list
    this.currentOptions.set(this.getOptionsFromKeywords(''));
  }

  // for callback pipe filter
  filterOptions(option: IMutliSelectOption) {
   return option.selected;
  }
}
