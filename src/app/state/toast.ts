import { createStore, useStore } from './store';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

const toasts = createStore<Toast[]>([]);
let toastCounter = 0;

export function showToast(message: string, config?: { duration?: number; type?: Toast['type'] }): void {
  const toast: Toast = {
    id: toastCounter++,
    message,
    type: config?.type || 'info',
    duration: config?.duration || 3000
  };

  toasts.set([...toasts.get(), toast]);

  if (toast.duration && toast.duration > 0) {
    setTimeout(() => removeToast(toast.id), toast.duration);
  }
}

export function removeToast(id: number): void {
  toasts.set(toasts.get().filter(t => t.id !== id));
}

export function clearToasts(): void {
  toasts.set([]);
}

export function useToasts(): Toast[] {
  return useStore(toasts);
}
