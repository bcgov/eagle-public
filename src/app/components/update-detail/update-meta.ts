import type { Update } from 'app/api/updates';
import { longDate } from 'app/utils/utils';

/** The one call to action an Update's ENGAGE link carries, wherever it renders. */
export const ENGAGE_LABEL = 'Take part in the engagement';

/** The line under a headline: project, location, date. A subject is named apart, as "About:". */
export function updateMeta(update: Update, projectAddress?: string | null): string {
  return [update.projectName, update.location ?? projectAddress, longDate(update.date)]
    .filter(Boolean)
    .join(' · ');
}
