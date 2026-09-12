import { documentsConfig } from './documents';
import { projectsConfig } from './projects';
import type { RecordId, RecordTypeConfig } from './record-type';

export * from './record-type';

/**
 * One entry per record type the unified page can render, keyed by the `record` URL value.
 *
 * Partial on purpose: Activities & updates and Project notifications are typed here and land as
 * two more entries later, so nothing that reads the registry has to change when they do.
 */
export const RECORD_TYPE_CONFIGS: Partial<Record<RecordId, RecordTypeConfig>> = {
  projects: projectsConfig,
  documents: documentsConfig,
};

/** The record types with a config, in tab order. */
export const CONFIGURED_RECORDS = Object.keys(RECORD_TYPE_CONFIGS) as RecordId[];

/** `undefined` for a record type this build cannot render yet, which the page treats as no tab. */
export function recordConfig(record: RecordId): RecordTypeConfig | undefined {
  return RECORD_TYPE_CONFIGS[record];
}
