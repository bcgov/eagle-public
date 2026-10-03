import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastCounter = 0;
  public toasts = signal<Toast[]>([]);

  show(message: string, action?: string, config?: { duration?: number; type?: Toast['type'] }) {
    const toast: Toast = {
      id: this.toastCounter++,
      message,
      type: config?.type || 'info',
      duration: config?.duration || 3000
    };

    this.toasts.update(toasts => [...toasts, toast]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.remove(toast.id), toast.duration);
    }
  }

  remove(id: number) {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  clear() {
    this.toasts.set([]);
  }
}
