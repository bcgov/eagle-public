import { Component, ChangeDetectionStrategy, input, output, effect, signal } from '@angular/core';
import { NgbDateStruct, NgbDatepickerModule, NgbInputDatepicker } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-input',
  templateUrl: './date-input.component.html',
  styleUrls: ['./date-input.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbDatepickerModule, FormsModule],
  standalone: true
})
export class DateInputComponent {
  date = input<Date | null>(null);
  isValidate = input<boolean>(false);
  minDate = input<Date | null>(null);
  maxDate = input<Date | null>(null);
  dateChange = output<Date | null>();

  ngbDate = signal<NgbDateStruct | null>(null);
  minNgbDate = signal<NgbDateStruct | null>(null);
  maxNgbDate = signal<NgbDateStruct | null>(null);

  constructor() {
    effect(() => {
      this.ngbDate.set(this.dateToNgbDate(this.date()));
    }, { allowSignalWrites: true });

    effect(() => {
      this.minNgbDate.set(this.dateToNgbDate(this.minDate()));
    }, { allowSignalWrites: true });

    effect(() => {
      this.maxNgbDate.set(this.dateToNgbDate(this.maxDate()));
    }, { allowSignalWrites: true });
  }

  onDateChg(ngbDate: NgbDateStruct) {
    this.ngbDate.set(ngbDate);
    this.dateChange.emit(ngbDate ? this.ngbDateToDate(ngbDate) : null);
  }

  isValidDate(date: NgbDateStruct | null): boolean {
    return (date !== null && !isNaN(date.year) && !isNaN(date.month) && !isNaN(date.day));
  }

  private dateToNgbDate(date: Date | null): NgbDateStruct | null {
    return date ? { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() } : null;
  }

  private ngbDateToDate(date: NgbDateStruct): Date {
    return new Date(date.year, date.month - 1, date.day);
  }
}
