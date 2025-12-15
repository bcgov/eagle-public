import {
  Component,
  input,
  OnInit,
  OnDestroy,
  signal,
  effect,
  ChangeDetectionStrategy,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDateStruct, NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Utils } from '../../utils/utils';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'lib-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDatepickerModule],
  standalone: true
})
export class DatePickerComponent implements OnInit, OnDestroy {
  control = input.required<FormControl>();
  isValidate = input(false);
  isDisabled = input(false);
  minDate = input<Date | null>(null);
  maxDate = input<Date | null>(null);
  reset = input<Subject<any>>();
  required = input(false);

  private ngUnsubscribe = new Subject<boolean>();
  private utils = inject(Utils);

  public ngbDate = signal<NgbDateStruct | null>(null);
  public minNgbDate = signal<NgbDateStruct | undefined>(undefined);
  public maxNgbDate = signal<NgbDateStruct | undefined>(undefined);

  constructor() {
    // Watch for min/max date changes
    effect(() => {
      const min = this.minDate();
      if (min) {
        const converted = this.utils.convertJSDateToNGBDate(new Date(min));
        this.minNgbDate.set(converted || undefined);
      }
    });

    effect(() => {
      const max = this.maxDate();
      if (max) {
        const converted = this.utils.convertJSDateToNGBDate(new Date(max));
        this.maxNgbDate.set(converted || undefined);
      }
    });
  }

  ngOnInit() {
    this.ngbDate.set(this.control().value || null);
    
    const resetSubject = this.reset();
    if (resetSubject) {
      resetSubject.pipe(takeUntil(this.ngUnsubscribe)).subscribe(() => this.clearDate());
    }
  }

  onDateChange(ngbDate: NgbDateStruct) {
    this.control().setValue(ngbDate);
    this.control().markAsDirty();
    this.ngbDate.set(ngbDate);
  }

  clearDate() {
    this.ngbDate.set(null);
    this.control().setValue(null);
    this.control().markAsDirty();
  }

  public isValidDate(date: NgbDateStruct | null): boolean {
    if (date === null && !this.required()) {
      return true;
    } else {
      return date !== null && !isNaN(date.year) && !isNaN(date.month) && !isNaN(date.day);
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
