/** An Act a project can be assessed under. Adding an Act is one entry in `ACTS`. */
export interface Act {
  year: number;
  /** Exactly the `legislation` string eagle-api writes on the project. */
  label: string;
  /** The Act's full text. */
  href: string;
  /** What the assessment rail draws: the 2018 to-scale stages, the `List` phase rows, or nothing. */
  stages: 'detailed' | 'phases' | 'none';
  /** The `List` phase rows to use when the Act has none of its own. */
  phaseRowsYear?: number;
  /** When the Act came into force, `YYYY-MM-DD`; `null` draws no legislation band segment. */
  inForce: string | null;
  /** Phase and step names no app data holds, from the EAO "EA 101" course (page 7). */
  phaseNames?: readonly string[];
  stepNames?: readonly string[];
}

export const ACTS: readonly Act[] = Object.freeze([
  Object.freeze({
    year: 1996,
    label: '1996 Environmental Assessment Act',
    href: 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96119_pit',
    stages: 'phases',
    phaseRowsYear: 2002,
    inForce: '1995-06-30',
    phaseNames: Object.freeze([
      'Pre-Application',
      'Application Review',
      'Referral',
      'Post Decision',
    ]),
    stepNames: Object.freeze([
      'Application for a PAC',
      'Draft Project Report Specifications',
      'Project Report',
      'Referral to Ministers',
      "Ministers' PAC Decision Issued/Refused",
      'Post Certificate Work and Amendments',
    ]),
  }),
  Object.freeze({
    year: 2002,
    label: '2002 Environmental Assessment Act',
    href: 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/02043_01',
    stages: 'phases',
    inForce: '2002-12-30',
  }),
  Object.freeze({
    year: 2018,
    label: '2018 Environmental Assessment Act',
    href: 'https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/18051',
    stages: 'detailed',
    inForce: '2019-12-16',
  }),
  Object.freeze({
    year: 2025,
    label: 'Building Canada Act',
    href: 'https://laws-lois.justice.gc.ca/eng/acts/B-9.89/page-1.html',
    stages: 'none',
    inForce: null,
  }),
] satisfies Act[]);

export function actByYear(year: number): Act | undefined {
  return ACTS.find((act) => act.year === year);
}

/** The Act assumed when a project's legislation is missing or unknown. */
export const DEFAULT_ACT: Act = actByYear(2018)!;

/** The Act a `legislation` label names: the exact label, else the first year in it, else none. */
export function actFor(legislation?: string): Act | undefined {
  if (!legislation) return undefined;
  const exact = ACTS.find((act) => act.label === legislation);
  if (exact) return exact;
  // A whole four-digit year, so a section or bill number such as 12018 is not read as one.
  const year = legislation.match(/\b(19|20)\d{2}\b/)?.[0];
  return year ? actByYear(Number(year)) : undefined;
}
