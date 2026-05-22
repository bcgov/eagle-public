import {
  Component,
  input,
  output,
  ChangeDetectorRef,
  inject,
  OnInit
} from '@angular/core';

import { FormControl, FormsModule } from '@angular/forms';
import { CustomMultiSelectComponent } from '../custom-multi-select/custom-multi-select.component';
import { FilterObject } from '../search-filter-template/filter-object';

@Component({
  selector: 'app-autocomplete-multi-select',
  templateUrl: './autocomplete-multi-select.component.html',
  styleUrls: ['./autocomplete-multi-select.component.css'],
  imports: [FormsModule, CustomMultiSelectComponent],
})
export class AutoCompleteMultiSelectComponent implements OnInit {
  private _changeDetectionRef = inject(ChangeDetectorRef);

  control = input.required<FormControl | null>();
  filter = input.required<FilterObject>();
  
  /*
    Example of multiSelect FilterObject

     public legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };
     public filter = new FilterObject(
       'milestone',
       FilterType.MultiSelect,
       'Milestone',
       new MultiSelectDefinition(
         [
           {
             legislation: '2002',
             name: 'Section 6',
             read: ["public", "staff", "sysadmin"],
             type: 'label',
             _id: "5cf00c03a266b7e1877504e1",
             _schemaName: "List"
           }
         ],
         [],
         this.legislationFilterGroup
       )
     );
  */

  changeEvent = output<void>();

  ngOnInit() {
    const filterValue = this.filter();
    const controlValue = this.control();
    
    if (filterValue.filterDefinition.matchId) {
      if (controlValue?.value) {
        const selectedOptionObjects: any[] = [];
        const controlValues = controlValue.value.split(',');
        filterValue.filterDefinition.options.forEach((option: any) => {
          if (controlValues.includes(option._id)) {
            selectedOptionObjects.push(option);
          } else if (controlValues.includes(option.code)) {
            selectedOptionObjects.push(option);
          }
        });
        filterValue.filterDefinition.selectedOptions = selectedOptionObjects;
      }
    } else {
      filterValue.filterDefinition.selectedOptions = controlValue?.value;
    }
  }

  onChange() {
    this.changeEvent.emit();
  }

  // comparator for filters. We use objects in Constants, or list objects from
  // the DB, so check for the possible identifiers of code or _id. If we have
  // neither, then assume a string to string comparison
  public filterCompareWith(item: any, itemToCompare: any) {
    if (Object.hasOwn(item, 'code')) {
      return item && itemToCompare ? item.code === itemToCompare.code : item === itemToCompare;
    } else if (Object.hasOwn(item, '_id')) {
      return item && itemToCompare ? item._id === itemToCompare._id : item === itemToCompare;
    } else {
      return item === itemToCompare;
    }
  }

  clearSelectedItem(filter: FilterObject, item: any) {
    // may have strings, or a list of code table items with _id values
    filter.filterDefinition.selectedOptions = filter.filterDefinition.selectedOptions.filter((option: any) => {
      if (option !== item && option._id !== item._id) {
        return item;
      }
    });
    this.changeEvent.emit();
  }
}
