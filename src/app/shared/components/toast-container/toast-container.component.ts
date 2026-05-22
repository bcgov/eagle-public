import { Component, inject } from '@angular/core';

import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [NgbToastModule],
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 11000">
      @for (toast of toastService.toasts(); track toast.id) {
        <ngb-toast
          [autohide]="toast.duration !== 0"
          [delay]="toast.duration || 3000"
          (hidden)="remove(toast.id)"
          [class]="'bg-' + getBootstrapClass(toast.type)">
          <div class="d-flex align-items-center">
            <div class="toast-body text-white flex-grow-1">
              {{ toast.message }}
            </div>
            <button type="button" 
              class="btn-close btn-close-white me-2" 
              aria-label="Close"
              (click)="remove(toast.id)">
            </button>
          </div>
        </ngb-toast>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      z-index: 11000;
    }
  `],
})
export class ToastContainerComponent {
  public toastService = inject(ToastService);

  remove(id: number) {
    this.toastService.remove(id);
  }

  getBootstrapClass(type: string): string {
    const classMap: Record<string, string> = {
      'success': 'success',
      'error': 'danger',
      'warning': 'warning',
      'info': 'info'
    };
    return classMap[type] || 'info';
  }
}
