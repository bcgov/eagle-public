import { activitiesConfig } from './activities';
import { documentsConfig } from './documents';
import { notificationsConfig } from './notifications';
import { projectsConfig } from './projects';
import type { RecordId, RecordTypeConfig } from './record-type';

export * from './record-type';

/** One entry per record type the unified page renders, keyed by the `record` URL value. */
export const RECORD_TYPE_CONFIGS: Record<RecordId, RecordTypeConfig> = {
  projects: projectsConfig,
  documents: documentsConfig,
  activities: activitiesConfig,
  notifications: notificationsConfig,
};

export function recordConfig(record: RecordId): RecordTypeConfig {
  return RECORD_TYPE_CONFIGS[record];
}
