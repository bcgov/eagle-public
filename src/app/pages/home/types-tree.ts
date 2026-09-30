import { Constants } from 'app/utils/constants';
import { logger } from 'app/config/logging';

export const OTHER = 'Other';

/** The ten project types, spelled as the rest of the app spells them. */
export const PROJECT_TYPES: readonly string[] = (
  Constants.PROJECT_TYPE_COLLECTION as { name: string }[]
).map((t) => t.name);

export interface ProjectRow {
  id: string;
  name: string;
  region: string;
  phase: string;
}

export interface SubNode {
  name: string;
  count: number;
  projects: ProjectRow[];
}

export interface TypeNode {
  name: string;
  count: number;
  subs: SubNode[];
}

/** The fields the tree reads; `Project` satisfies it. */
export interface TypeTreeSource {
  _id: string;
  name?: string | null;
  type?: string | null;
  sector?: string | null;
  region?: string | null;
  currentPhaseName?: unknown;
}

// Track and Eagle disagree on spacing round the hyphen and on a trailing "s"
// ("Energy - Electricity", "Tourist Destination Resort"); compare on a loose key.
const typeKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '');

const TYPE_BY_KEY = new Map(PROJECT_TYPES.map((name) => [typeKey(name), name]));

/** Maps any corpus spelling of a project type to its `PROJECT_TYPES` name; unknown or empty is "Other". */
export function normalizeType(type: string | null | undefined): string {
  return TYPE_BY_KEY.get(typeKey(type ?? '')) ?? OTHER;
}

const subTypeOf = (sector: string | null | undefined): string => {
  const name = (sector ?? '').trim();
  return name === '' || name.toLowerCase() === OTHER.toLowerCase() ? OTHER : name;
};

const phaseOf = (phase: unknown): string => {
  if (typeof phase === 'object' && phase !== null && 'name' in phase) {
    const { name } = phase;
    return typeof name === 'string' ? name : '';
  }
  return '';
};

/** Largest first, "Other" always last, ties by name so the order is stable. */
const byCountOtherLast = (a: { name: string; count: number }, b: { name: string; count: number }) =>
  Number(a.name === OTHER) - Number(b.name === OTHER) ||
  b.count - a.count ||
  a.name.localeCompare(b.name);

interface SubGroup {
  /** The first spelling seen, which the band shows. */
  name: string;
  rows: ProjectRow[];
}

/**
 * Groups projects by type, then sub-type (the project's sector, compared without case). Types with
 * no projects are left out, and so are rows with no id, which could not link to a project.
 */
export function buildTypeTree(projects: readonly TypeTreeSource[]): TypeNode[] {
  const types = new Map<string, Map<string, SubGroup>>();
  let skipped = 0;
  for (const p of projects) {
    if (!p._id) {
      skipped++;
      continue;
    }
    const type = normalizeType(p.type);
    const sub = subTypeOf(p.sector);
    const subs = types.get(type) ?? new Map<string, SubGroup>();
    types.set(type, subs);
    const key = sub.toLowerCase();
    const group = subs.get(key) ?? { name: sub, rows: [] };
    subs.set(key, group);
    group.rows.push({
      id: p._id,
      name: p.name ?? '',
      region: p.region ?? '',
      phase: phaseOf(p.currentPhaseName),
    });
  }
  if (skipped)
    logger.warn(`Left ${skipped} projects with no id out of the type tree`, 'ProjectsByType');

  const tree: TypeNode[] = [...types].map(([name, subs]) => {
    const subNodes: SubNode[] = [...subs.values()].map(({ name: subName, rows }) => ({
      name: subName,
      count: rows.length,
      projects: rows.sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return {
      name,
      count: subNodes.reduce((sum, s) => sum + s.count, 0),
      subs: subNodes.sort(byCountOtherLast),
    };
  });
  return tree.sort(byCountOtherLast);
}

/** "1 project", "3 projects". */
export const projectsLabel = (count: number): string =>
  `${count} ${count === 1 ? 'project' : 'projects'}`;

const SHADES = [
  '--theme-blue-100',
  '--theme-blue-90',
  '--theme-blue-80',
  '--theme-blue-70',
  '--theme-blue-60',
  '--theme-blue-50',
  '--theme-blue-40',
  '--theme-blue-30',
  '--theme-blue-20',
  '--theme-gray-40',
];

/** Index of the last shade; "Other" always takes it. */
export const OTHER_RANK = SHADES.length - 1;

/** A type's colour rank: its position among the non-"Other" types, "Other" (or unknown) last. */
export function rankOf(tree: readonly TypeNode[], type: string): number {
  if (type === OTHER) return OTHER_RANK;
  const i = tree.filter((t) => t.name !== OTHER).findIndex((t) => t.name === type);
  return i < 0 ? OTHER_RANK : i;
}

/**
 * A sub-type's colour rank from its place in its type's list. "Other" always takes the gray. The
 * rest cycle through the blues rather than clamp, so a tenth sub-type does not share the shade of
 * the ninth beside it; the list is largest first, so the repeat lands on a small tile far from the
 * first.
 */
export function subRank(name: string, index: number): number {
  return name === OTHER ? OTHER_RANK : index % OTHER_RANK;
}

/** Fill for rank `i`: darkest blue first, gray from the last shade on. */
export function shade(i: number): string {
  return `var(${SHADES[Math.min(Math.max(i, 0), OTHER_RANK)]})`;
}

/** Text colour that stays readable on `shade(i)`. */
export function ink(i: number): string {
  if (i <= 2) return 'var(--theme-gray-white)';
  return i === 3 ? 'var(--theme-gray-110)' : 'var(--theme-blue-100)';
}
