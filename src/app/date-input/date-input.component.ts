import { Component, ChangeDetectionStrategy, input, output, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-input',
  templateUrl: './date-input.component.html',
  styleUrls: ['./date-input.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  standalone: true
})
export class DateInputComponent {
  date = input<Date | null>(null);
  isValidate = input<boolean>(false);
  minDate = input<Date | null>(null);
  maxDate = input<Date | null>(null);
  dateChange = output<Date | null>();

  dateString = signal<string>('');
  minDateString = signal<string>('');
  maxDateString = signal<string>('');

  constructor() {
    effect(() => {
      this.dateString.set(this.dateToISO(this.date()));
    });

    effect(() => {
      this.minDateString.set(this.dateToISO(this.minDate()));
    });

    effect(() => {
      this.maxDateString.set(this.dateToISO(this.maxDate()));
    });
  }

  onDateChg(dateStr: string) {
    this.dateString.set(dateStr);
    this.dateChange.emit(dateStr ? new Date(dateStr) : null);
  }

  isValidDate(date: string): boolean {
    return date !== '' && !isNaN(Date.parse(date));
  }

  private dateToISO(date: Date | null): string {
    return date ? date.toISOString().split('T')[0] : '';
  }
}
