import { removeToast, useToasts, type Toast } from 'app/state/toast';

const BOOTSTRAP_CLASS: Record<Toast['type'], string> = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info'
};

export function ToastContainer() {
  const toasts = useToasts();

  return (
    <div
      className="toast-container position-fixed top-0 end-0 p-3"
      style={{ zIndex: 11000 }}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(toast => (
        <div key={toast.id} className={`toast show bg-${BOOTSTRAP_CLASS[toast.type] ?? 'info'}`}>
          <div className="d-flex align-items-center">
            <div className="toast-body text-white flex-grow-1">{toast.message}</div>
            <button
              type="button"
              className="btn-close btn-close-white me-2"
              aria-label="Close"
              onClick={() => removeToast(toast.id)}
            ></button>
          </div>
        </div>
      ))}
    </div>
  );
}
