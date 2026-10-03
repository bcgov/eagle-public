import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { GateService } from 'app/services/gate.service';

/** Password curtain shown instead of the app while ACCESS_GATE is true. */
@Component({
  selector: 'app-gate',
  templateUrl: './gate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class GateComponent {
  private gate = inject(GateService);
  private passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('password');

  error = signal('');
  busy = signal(false);

  constructor() {
    afterNextRender(() => this.passwordInput().nativeElement.focus());
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (!(await this.gate.unlock(this.passwordInput().nativeElement.value))) {
        this.error.set('Incorrect password');
      }
    } catch {
      this.error.set('Could not check the password. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
