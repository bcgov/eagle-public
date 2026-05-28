import {
  Component,
  input,
  OnInit,
  DestroyRef,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { Utils } from '../../utils/utils';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoggingService } from 'app/services/logging.service';

@Component({
  selector: 'lib-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDatepickerModule],
})
export class DatePickerComponent implements OnInit {
  control = input.required<FormControl>();
  isValidate = input(false);
  isDisabled = input(false);
  minDate = input<Date | null>(null);
  maxDate = input<Date | null>(null);
  reset = input<Subject<any>>();
  required = input(false);

  private destroyRef = inject(DestroyRef);
  private utils = inject(Utils);
  private logger = inject(LoggingService);

  public dateValue = signal<NgbDateStruct | null>(null);
  public minDateStruct = signal<NgbDateStruct | null>(null);
  public maxDateStruct = signal<NgbDateStruct | null>(null);
  
  // Computed signals that return undefined instead of null for ngbDatepicker compatibility
  public minDateForPicker = computed(() => this.minDateStruct() ?? undefined);
  public maxDateForPicker = computed(() => this.maxDateStruct() ?? undefined);

  constructor() {
    // Watch for min/max date changes and convert to NgbDateStruct
    effect(() => {
      const min = this.minDate();
      if (min) {
        this.minDateStruct.set(this.dateToNgbDateStruct(new Date(min)));
      }
    });

    effect(() => {
      const max = this.maxDate();
      if (max) {
        this.maxDateStruct.set(this.dateToNgbDateStruct(new Date(max)));
      }
    });
  }

  private dateToNgbDateStruct(date: Date): NgbDateStruct {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }

  private ngbDateStructToDate(dateStruct: NgbDateStruct): Date {
    return new Date(dateStruct.year, dateStruct.month - 1, dateStruct.day);
  }

  ngOnInit() {
    const ctrl = this.control();
    if (!ctrl) {
      this.logger.debug('DatePicker control is null - parent may not have registered this form control yet', 'DatePickerComponent');
      return;
    }
    
    // Convert control value to NgbDateStruct
    const value = ctrl.value;
    if (value) {
      if (typeof value === 'string') {
        // Convert ISO string to NgbDateStruct
        const date = new Date(value);
        this.dateValue.set(this.dateToNgbDateStruct(date));
      } else if (value instanceof Date) {
        this.dateValue.set(this.dateToNgbDateStruct(value));
      } else if (typeof value === 'object' && 'year' in value) {
        // Already NgbDateStruct
        this.dateValue.set(value);
      }
    }
    
    const resetSubject = this.reset();
    if (resetSubject) {
      resetSubject.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.clearDate());
    }
    
    // Subscribe to control value changes to sync dateValue
    ctrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (value) {
          if (typeof value === 'string') {
            const date = new Date(value);
            this.dateValue.set(this.dateToNgbDateStruct(date));
          } else if (value instanceof Date) {
            this.dateValue.set(this.dateToNgbDateStruct(value));
          } else if (typeof value === 'object' && 'year' in value) {
            this.dateValue.set(value);
          }
        } else {
          this.dateValue.set(null);
        }
      });
  }

  onDateChange(dateStruct: NgbDateStruct | null) {
    const ctrl = this.control();
    if (!ctrl) return;
    
    if (dateStruct) {
      // Convert NgbDateStruct to ISO string for storage
      const isoString = `${dateStruct.year}-${String(dateStruct.month).padStart(2, '0')}-${String(dateStruct.day).padStart(2, '0')}`;
      ctrl.setValue(isoString);
      ctrl.markAsDirty();
      this.dateValue.set(dateStruct);
    } else {
      ctrl.setValue('');
      ctrl.markAsDirty();
      this.dateValue.set(null);
    }
  }

  clearDate() {
    const ctrl = this.control();
    this.dateValue.set(null);
    if (!ctrl) return;
    
    ctrl.setValue('');
    ctrl.markAsDirty();
  }

  public isValidDate(dateStruct: NgbDateStruct | null): boolean {
    if (!dateStruct && !this.required()) {
      return true;
    }
    if (!dateStruct) {
      return false;
    }
    // Check if date is valid
    return dateStruct.year > 0 && dateStruct.month > 0 && dateStruct.month <= 12 && dateStruct.day > 0 && dateStruct.day <= 31;
  }
}
