import { Document } from '../../models/document';
import { ApiService } from '../../services/api';
import { ToastService } from '../../services/toast.service';

/** Starts a document download and tells the user whether it could start. Never rejects. */
export async function downloadDocumentWithToast(api: ApiService, toast: ToastService, document: Document): Promise<void> {
  try {
    await api.downloadDocument(document);
  } catch {
    toast.show('Error opening document! Please try again later', '', { duration: 2000, type: 'error' });
    return;
  }
  // The file arrives in a hidden frame the page cannot watch, so this only says it was asked for.
  toast.show('Starting download', '', { duration: 2000, type: 'info' });
}
