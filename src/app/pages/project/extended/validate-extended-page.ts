import {
  COMMENT_PERIOD_SEGMENT,
  LEGACY_DOCUMENT_TABS,
  RENAMED_PROJECT_TABS,
} from 'app/routes/project-segments';
import { isSitePath } from 'app/utils/safe-url';
import { isContentHref } from './content-href';
import {
  contentTabFor,
  isContentEntry,
  isStandardSegment,
  STANDARD_SEGMENTS,
} from './extended-page';
import { LINE_COLOURS, type Block, type ExtendedPage, type TabEntry } from './types';

/** What a custom tab's URL segment may look like. */
const CUSTOM_SEGMENT_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

/** Paths the project route already holds, so a custom tab there would never be reached. */
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  ...LEGACY_DOCUMENT_TABS,
  ...RENAMED_PROJECT_TABS.map(({ from }) => from),
  COMMENT_PERIOD_SEGMENT,
]);

/** Fields of a content entry the standard Overview does not read when blocks are appended to it. */
const OVERVIEW_APPEND_IGNORES = ['label', 'title', 'intro', 'count', 'layout'] as const;

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

/**
 * In-page links to another tab that name no tab on the page, or a tab drawn by the standard
 * component, which never reads the link's focus flag.
 */
function tabLinkProblems(where: string, blocks: Block[], page: ExtendedPage): string[] {
  const segments = page.tabs?.map((entry) => entry.segment) ?? [...STANDARD_SEGMENTS];
  return blocks.flatMap((block) => {
    const target =
      block.type === 'band' ? block.primary?.tab : block.type === 'updates' ? block.tab : undefined;
    if (target === undefined || contentTabFor(page, target)) return [];
    const why = segments.includes(target)
      ? 'a standard tab, which does not take focus from the link'
      : 'which the page does not have';
    return [`${where}: block "${block.id}" links to tab "${target}", ${why}`];
  });
}

/** The lists in a block that key their rows by content, each with what its key is. */
function blockKeys(block: Block): [string, string[]][] {
  switch (block.type) {
    case 'contacts':
      return [['contact label', block.items.map((contact) => contact.label)]];
    case 'links':
      return block.style === 'cards'
        ? [['link label', block.items.map((item) => item.label)]]
        : [['link address and label', block.items.map((item) => item.href + item.label)]];
    case 'definitions':
      return [['definition term', block.items.map((item) => item.term)]];
    case 'table':
      return [['table row name', block.rows.map((row) => row.name)]];
    case 'columns':
      return [['column heading', block.columns.map((column) => column.heading)]];
    case 'steps':
    case 'band':
      return [['step name', block.steps.map((step) => step.name)]];
    case 'summary':
      return [
        ['stat label', block.stats?.map((stat) => stat.label) ?? []],
        ['summary item', block.items ?? []],
      ];
    case 'projects':
      return [['project id', block.items.map((item) => item.id)]];
    default:
      return [];
  }
}

/** Values a list keys its rows by, so each must be unique. */
function keyProblems(page: ExtendedPage): string[] {
  const groups = page.documents?.external?.groups ?? [];
  const keyed: [string, string[]][] = [
    ['masthead action link', page.masthead?.actions?.map((action) => action.href) ?? []],
    ['panel fact label', page.panel?.facts?.map((fact) => fact.label) ?? []],
    ['timeline step name', page.timeline?.steps.map((step) => step.name) ?? []],
    ['update link and date', page.updates?.map((update) => update.href + update.date) ?? []],
    ['external document publisher', groups.map((group) => group.publisher)],
    ...groups.map((group): [string, string[]] => [
      `external document link from "${group.publisher}"`,
      group.items.map((doc) => doc.href),
    ]),
    // Terms match in any case, so two that differ only in case link the same words.
    ['autoLinks text', page.autoLinks?.map((link) => link.text.toLowerCase()) ?? []],
  ];
  for (const entry of page.tabs ?? []) {
    if (!isContentEntry(entry)) continue;
    const blocks = [...(entry.banner ?? []), ...entry.main, ...(entry.aside ?? [])];
    for (const block of blocks) {
      for (const [what, values] of blockKeys(block)) {
        keyed.push([`tab "${entry.segment}" block "${block.id}" ${what}`, values]);
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
  if (segment === 'overview' && !entry.replace) {
    for (const field of OVERVIEW_APPEND_IGNORES) {
      if (entry[field] !== undefined) {
        problems.push(
          `${where}: ${field} is ignored when blocks are appended; set replace to use it`,
        );
      }
    }
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
