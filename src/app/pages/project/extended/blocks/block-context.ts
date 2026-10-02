import type { Project } from 'app/models/project';
import type { ExtendedPage } from '../types';

/** What a block reads besides its own fields. */
export interface BlockContext {
  /** The tab's segment, for heading ids. */
  segment: string;
  content: ExtendedPage;
  /** The project record: the summary's fallback description comes from it. */
  project: Project | null;
  /** `/p/:projId`, for links to sibling tabs. */
  basePath: string;
  /** Block heading level: 2 on a tab without a title, 3 under one. */
  level: 2 | 3;
  /** False when the region around the block is named by its heading instead of the block. */
  labelled: boolean;
}

/** The id of a block's heading. */
export function headingId(segment: string, id: string): string {
  return `extended-${segment}-${id}`;
}

/** The truthy class names, space separated; undefined when there are none. */
export function classNames(...names: (string | false | undefined)[]): string | undefined {
  return names.filter(Boolean).join(' ') || undefined;
}
