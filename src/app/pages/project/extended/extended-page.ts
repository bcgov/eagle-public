import { extendedPageKey } from 'app/config/config';
import { pacificLink } from './content/pacific-link';
import type {
  Block,
  ContentTabEntry,
  ExtendedPage,
  ExtendedStepState,
  ExtendedStepWithState,
  ExtendedTimeline,
  StandardSegment,
  TabEntry,
} from './types';

/** Every standard tab segment, in the standard strip's order. */
export const STANDARD_SEGMENTS: readonly StandardSegment[] = [
  'overview',
  'updates',
  'engagement',
  'documents',
  'decisions',
  'compliance',
];

export function isStandardSegment(segment: string): segment is StandardSegment {
  return (STANDARD_SEGMENTS as readonly string[]).includes(segment);
}

/** A tab drawn from content, as against a bare standard entry. */
export function isContentEntry(entry: TabEntry): entry is ContentTabEntry {
  return 'main' in entry;
}

/** The page's entry for `segment`, if its `tabs` name it. */
export function tabEntry(page: ExtendedPage | null, segment: string): TabEntry | undefined {
  return page?.tabs?.find((entry) => entry.segment === segment);
}

/**
 * The content tab drawn at `segment`, or null where the standard tab (or nothing) is. On a standard
 * segment only an entry with `replace` takes the tab over; on a custom one any entry with blocks does.
 */
export function contentTabFor(page: ExtendedPage | null, segment: string): ContentTabEntry | null {
  const entry = tabEntry(page, segment);
  if (!entry || !isContentEntry(entry)) return null;
  return !isStandardSegment(segment) || entry.replace ? entry : null;
}

/** An overview entry without `replace`: blocks the standard Overview draws after its own. */
export function overviewAppend(page: ExtendedPage | null): ContentTabEntry | null {
  const entry = tabEntry(page, 'overview');
  return entry && isContentEntry(entry) && !entry.replace ? entry : null;
}

/** The `banner` blocks drawn between the strip and the tab at `segment`, appended or not. */
export function bannerFor(page: ExtendedPage | null, segment: string): Block[] {
  const entry = tabEntry(page, segment);
  return (entry && isContentEntry(entry) && entry.banner) || [];
}

/** Content keys the EXTENDED_PROJECT_PAGES config may name. */
export const EXTENDED_CONTENT: Readonly<Record<string, ExtendedPage>> = {
  'pacific-link': pacificLink,
};

/**
 * The extended project page content for a project, or null for every project the runtime config
 * does not name (or names with an unknown key), which keeps the EAO page.
 */
export function extendedPageFor(projId: string): ExtendedPage | null {
  const key = extendedPageKey(projId);
  return (key && Object.hasOwn(EXTENDED_CONTENT, key) && EXTENDED_CONTENT[key]) || null;
}

function stateFor(index: number, currentStep: number): ExtendedStepState {
  if (index < currentStep) return 'complete';
  return index === currentStep ? 'current' : 'upcoming';
}

/** The timeline's steps, each with its state read off the current step. */
export function extendedSteps(timeline: ExtendedTimeline): ExtendedStepWithState[] {
  return timeline.steps.map((step, index) => ({
    ...step,
    state: stateFor(index, timeline.currentStep),
  }));
}
