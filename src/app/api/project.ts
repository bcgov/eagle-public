import { Project } from 'app/models/project';
import * as api from './api';
import type { DemiProject } from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { commentPeriodsQueryOptions } from './commentperiod';
import type { QueryClient } from '@tanstack/react-query';
import { natureBuildMapper } from 'app/utils/utils';
import { logger } from 'app/config/logging';

/** DEMI caps an anonymous native page here, and the public app is always anonymous. */
const PROJECTS_PAGE_SIZE = 100;

/**
 * Every project matching `q` (all of them without one), read a page at a time. With `q` the rows
 * keep DEMI's best-match-first order; without, they come by name.
 */
async function readProjects(
  q?: string,
  signal?: AbortSignal,
): Promise<{ projects: Project[]; total: number }> {
  const read = (page: number) =>
    api.listNative<DemiProject>(
      'projects',
      { page, pageSize: PROJECTS_PAGE_SIZE, count: true, q, sort: q ? undefined : 'name' },
      signal,
    );
  const first = await read(1);
  const total = first.total ?? first.rows.length;
  const pageCount = Math.ceil(total / PROJECTS_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, at) => read(at + 2)),
  );
  const rows = [first, ...rest].flatMap((page) => page.rows);
  if (rows.length < total) {
    logger.warn(`Projects answered ${rows.length} of ${total} rows`, 'project');
  }
  return { projects: rows.map(Project.fromNative), total };
}

/**
 * The project total DEMI counted behind `allProjectsQueryOptions`, which can exceed the rows it sent.
 * A sibling of the list key, so invalidating the list never refetches this fetch-less query.
 */
export const ALL_PROJECTS_TOTAL_KEY = ['projects', 'all-total'] as const;

/**
 * Every public project; the key is shared with /projects so both read one cache entry. A failed
 * read throws, so the query retries and caches nothing. The total goes under `ALL_PROJECTS_TOTAL_KEY`.
 */
export function allProjectsQueryOptions() {
  return {
    queryKey: ['projects', 'all'],
    // Each try asks for the full list, so an outage costs one retry per mount, not three.
    retry: 1,
    queryFn: async ({ client }: { client: QueryClient }): Promise<Project[]> => {
      const { projects, total } = await readProjects();
      client.setQueryData(ALL_PROJECTS_TOTAL_KEY, total);
      return projects;
    },
  };
}

/**
 * Ids of the projects matching the keywords, best match first. Pass React Query's `signal` so a
 * superseded search aborts.
 */
export async function searchProjectIds(keywords: string, signal?: AbortSignal): Promise<string[]> {
  const { projects } = await readProjects(keywords, signal);
  return projects.map((project) => project._id);
}

/**
 * The comment periods the banner may draw, from every period of the project.
 *
 * A period qualifies when it starts inside the window, ends inside it, or spans it. Rows arrive
 * from DEMI read anonymously, so visibility has already been decided.
 */
export function periodsInWindow(
  periods: CommentPeriod[],
  since: string | null,
  until: string | null,
): CommentPeriod[] {
  if (since === null || until === null) return [];
  const from = Date.parse(since);
  const to = Date.parse(until);
  if (Number.isNaN(from) || Number.isNaN(to)) return [];

  // Rows arrive either as raw API date strings or as `CommentPeriod` instances holding `Date`s.
  const timeOf = (value: string | Date | undefined): number => new Date(value ?? '').getTime();

  return periods.filter((period) => {
    const started = timeOf(period?.dateStarted);
    const completed = timeOf(period?.dateCompleted);
    const startsInside = started >= from && started <= to;
    const endsInside = completed >= from && completed <= to;
    const spans = started <= from && completed >= to;
    return startsInside || endsInside || spans;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The period the banner draws: of those from 21 days back to 14 ahead, one running now, else the
 * first. `null` when none qualifies.
 */
export function bannerPeriod(periods: CommentPeriod[], now = Date.now()): CommentPeriod | null {
  const near = periodsInWindow(
    periods,
    new Date(now - 21 * DAY_MS).toISOString(),
    new Date(now + 14 * DAY_MS).toISOString(),
  );
  // Last match, as the Angular app picked when two periods run at once.
  const running = [...near]
    .reverse()
    .find(
      (period) =>
        Date.parse(String(period.dateStarted)) < now &&
        Date.parse(String(period.dateCompleted)) > now,
    );
  const chosen = running ?? near[0];
  return chosen ? new CommentPeriod(chosen) : null;
}

// Module-level, so `select` keeps one identity and React Query memoises its answer.
const selectBanner = (periods: CommentPeriod[]) => bannerPeriod(periods);

/**
 * The project's banner period, on the key the engagement tab reads too. Separate from the project
 * read, so the page renders without waiting on it.
 */
export function bannerPeriodQueryOptions(projId: string) {
  return { ...commentPeriodsQueryOptions(projId), select: selectBanner };
}

/**
 * The single project, from DEMI. `null` when DEMI holds no such project, which the page renders as
 * "Project not found". A read that fails throws: a store that cannot be reached is not a missing
 * project, and the page has its own error state for it.
 */
export async function getById(projId: string): Promise<Project | null> {
  const doc = await api.getDemiProject(projId);
  if (!doc) return null;
  const project = Project.fromNative(doc);
  project.nature = natureBuildMapper(project.build);
  return project;
}

/** A pinned Indigenous Nation as DEMI carries it on the project document. */
export type Pin = NonNullable<DemiProject['pins']>[number];

const byName = (a: Pin, b: Pin) => (a.name ?? '').localeCompare(b.name ?? '');

// Module-level for the same memoising reason as `selectBanner`.
const selectPins = (doc: DemiProject | null): Pin[] => [...(doc?.pins ?? [])].sort(byName);

/**
 * The project's pinned Indigenous Nations by name, off the one cached DEMI project document: no
 * request of its own. No document, or one with no pins, means no pins.
 */
export function projectPinsQueryOptions(projId: string) {
  return { ...api.demiProjectQueryOptions(projId), select: selectPins };
}
