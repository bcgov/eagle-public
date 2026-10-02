import {
  COMMENT_PERIOD_SEGMENT,
  LEGACY_DOCUMENT_TABS,
  RENAMED_PROJECT_TABS,
} from 'app/routes/project-segments';
import { isSitePath } from 'app/utils/safe-url';
import { isContentHref } from './content-href';
import { isContentEntry, isStandardSegment, STANDARD_SEGMENTS } from './extended-page';
import { LINE_COLOURS, type Block, type ExtendedPage, type TabEntry } from './types';

/** What a custom tab's URL segment may look like. */
const CUSTOM_SEGMENT_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

/** Paths the project route already holds, so a custom tab there would never be reached. */
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  ...LEGACY_DOCUMENT_TABS,
  ...RENAMED_PROJECT_TABS.map(({ from }) => from),
  COMMENT_PERIOD_SEGMENT,
]);

/** Each value that occurs more than once, once. */
function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

/** Anything a JSON round trip would drop or change: undefined, functions, dates, NaN. */
function jsonProblems(value: unknown, path: string): string[] {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return [];
  if (typeof value === 'number') {
    return Number.isFinite(value) ? [] : [`${path} is not a finite number`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => jsonProblems(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return [`${path} is not a plain object`];
    }
    return Object.entries(value).flatMap(([key, item]) => jsonProblems(item, `${path}.${key}`));
  }
  return [`${path} is not JSON (${typeof value})`];
}

/** Every `href` anywhere in the page that content may not link to (see content-href.ts). */
function hrefProblems(value: unknown, path: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => hrefProblems(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) =>
    key === 'href' && typeof item === 'string' && !isContentHref(item)
      ? [`${path}.href "${item}" is not https:, mailto:, tel: or a site path`]
      : hrefProblems(item, `${path}.${key}`),
  );
}

/** The segments the page's strip shows: its `tabs`, or the standard ones when it sets none. */
function stripSegments(page: ExtendedPage): string[] {
  return page.tabs?.map((entry) => entry.segment) ?? [...STANDARD_SEGMENTS];
}

/** In-page links to another tab that name no tab on the page. */
function tabLinkProblems(where: string, blocks: Block[], page: ExtendedPage): string[] {
  const segments = stripSegments(page);
  return blocks.flatMap((block) => {
    const target =
      block.type === 'band' ? block.primary?.tab : block.type === 'updates' ? block.tab : undefined;
    return target !== undefined && !segments.includes(target)
      ? [`${where}: block "${block.id}" links to tab "${target}", which the page does not have`]
      : [];
  });
}

/** Values a list keys its rows by, so each must be unique. */
function keyProblems(page: ExtendedPage): string[] {
  const keyed: [string, string[]][] = [
    ['panel fact label', page.panel?.facts?.map((fact) => fact.label) ?? []],
    ['update link and date', page.updates?.map((update) => update.href + update.date) ?? []],
  ];
  for (const entry of page.tabs ?? []) {
    if (!isContentEntry(entry)) continue;
    const blocks = [...(entry.banner ?? []), ...entry.main, ...(entry.aside ?? [])];
    for (const block of blocks) {
      if (block.type === 'contacts') {
        keyed.push([
          `tab "${entry.segment}" contact label`,
          block.items.map((contact) => contact.label),
        ]);
      }
    }
  }
  return keyed.flatMap(([what, values]) =>
    duplicates(values).map((value) => `${what} "${value}" is used more than once`),
  );
}

function tabProblems(entry: TabEntry, page: ExtendedPage): string[] {
  const { segment } = entry;
  const where = `tab "${segment}"`;
  const standard = isStandardSegment(segment);
  const problems: string[] = [];

  if (!standard && !CUSTOM_SEGMENT_PATTERN.test(segment)) {
    problems.push(`${where}: a custom segment must match ${CUSTOM_SEGMENT_PATTERN.source}`);
  } else if (RESERVED_SEGMENTS.has(segment)) {
    problems.push(`${where}: the segment is already a project route`);
  }

  if (!isContentEntry(entry)) {
    if (!standard) problems.push(`${where}: a custom tab needs main blocks`);
    return problems;
  }

  if (standard && segment !== 'overview' && !entry.replace) {
    problems.push(`${where}: only overview appends blocks; set replace to draw this tab instead`);
  }
  if (entry.count === 'updates' && !page.updates) {
    problems.push(`${where}: count "updates" needs the page's updates`);
  }

  const blocks = [...(entry.banner ?? []), ...entry.main, ...(entry.aside ?? [])];
  for (const id of duplicates(blocks.map((block) => block.id))) {
    problems.push(`${where}: block id "${id}" is used more than once`);
  }
  problems.push(...tabLinkProblems(where, blocks, page));
  if (!page.map) {
    for (const block of blocks.filter((each) => each.type === 'routeMap')) {
      problems.push(`${where}: routeMap block "${block.id}" needs the page's map`);
    }
  }
  return problems;
}

/**
 * Every rule an extended page must meet that its type cannot express. Empty when the page is
 * sound; otherwise one line per problem, naming where it is.
 */
export function validateExtendedPage(page: ExtendedPage): string[] {
  const problems = jsonProblems(page, 'page');
  if (page.version !== 1) problems.push(`version is ${String(page.version)}, not 1`);
  if (page.panel?.timeline && !page.timeline) {
    problems.push('panel.timeline is set, but the page has no timeline');
  }
  if (page.panel?.map && !page.map) problems.push('panel.map is set, but the page has no map');
  if (page.map && !isSitePath(page.map.geojsonUrl)) {
    problems.push(`map.geojsonUrl "${page.map.geojsonUrl}" is not a path on this site`);
  }
  for (const id of duplicates(page.map?.lines.map((line) => line.id) ?? [])) {
    problems.push(`map line id "${id}" is used more than once`);
  }
  if (page.map && page.map.lines.length > LINE_COLOURS.length) {
    problems.push(
      `map has ${page.map.lines.length} lines, but only ${LINE_COLOURS.length} colours`,
    );
  }
  const timeline = page.timeline;
  if (
    timeline &&
    !(
      Number.isInteger(timeline.currentStep) &&
      timeline.currentStep >= 0 &&
      timeline.currentStep <= timeline.steps.length
    )
  ) {
    problems.push(
      `timeline.currentStep ${timeline.currentStep} is not a step index from 0 to ${timeline.steps.length}`,
    );
  }
  if (page.tabs && !page.tabs.some((entry) => entry.segment === 'overview')) {
    problems.push('tabs has no overview entry');
  }
  for (const segment of duplicates(page.tabs?.map((entry) => entry.segment) ?? [])) {
    problems.push(`tab "${segment}" is listed more than once`);
  }
  for (const entry of page.tabs ?? []) problems.push(...tabProblems(entry, page));
  problems.push(...hrefProblems(page, 'page'), ...keyProblems(page));
  return problems;
}
