import type { ReactNode } from 'react';
import type { ProjectEngagement } from 'app/api/commentperiod';
import { ExternalLink } from 'app/components/external-link';
import { pacificLongDay } from 'app/models/commentperiod';
import type { Project } from 'app/models/project';
import { actFor } from 'app/utils/legislation';
import { longDateBc, longDateUtc } from 'app/utils/utils';
import type { PhaseListItem } from './assessment-stages';
import type { StandingDecision } from './project-standing';
import type { useProjectSummary } from './use-project-summary';

type SummaryData = ReturnType<typeof useProjectSummary>;

/** What the shell hands every per-type piece once the project is in. */
export interface SummaryPieceProps {
  summary: SummaryData;
  project: Project | null;
  projId: string;
  lists: PhaseListItem[];
  /** The List rows are still in flight; only the assessment rail waits on them. */
  listsLoading: boolean;
}

export interface FactRow {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  loading?: boolean;
}

export const NOT_SET = 'Not set';
const LABEL = {
  category: 'Project Category',
  entered: 'Entered the EA Process',
  legislation: 'Legislation',
  phaseStart: 'Phase Start',
  phaseEnd: 'Anticipated Phase End',
  engagement: 'Next Public Engagement',
};
export const PROJECT_FACT_LABELS = [LABEL.category, LABEL.entered, LABEL.legislation];
export const PHASE_FACT_LABELS = [LABEL.phaseStart, LABEL.phaseEnd];

/** A fact with no value still holds its row, so the grid keeps its shape on every project. */
export function empty(text: string) {
  return <span className="project-summary__empty">{text}</span>;
}

/** Track sends midnight-UTC dates; Eagle's read in BC, as `windowStart` in summary-exited.tsx. */
export function decisionDateFormat(decision: StandingDecision) {
  return decision.source === 'track' ? longDateUtc : longDateBc;
}

function legislationFact(summary: SummaryData): FactRow {
  const href = actFor(summary.legislation ?? undefined)?.href;
  return {
    label: LABEL.legislation,
    value: !summary.legislation ? (
      empty(NOT_SET)
    ) : href ? (
      <ExternalLink href={href}>{summary.legislation}</ExternalLink>
    ) : (
      summary.legislation
    ),
  };
}

/** Category, entry into the EA process and the Act: the first column on most types. */
export const projectFacts = (summary: SummaryData): FactRow[] => [
  { label: LABEL.category, value: summary.category || empty(NOT_SET) },
  { label: LABEL.entered, value: longDateUtc(summary.enteredOn) || empty(NOT_SET) },
  legislationFact(summary),
];

export const phaseDateFacts = (summary: SummaryData): FactRow[] => [
  { label: LABEL.phaseStart, value: longDateUtc(summary.phaseStart) || empty(NOT_SET) },
  { label: LABEL.phaseEnd, value: longDateUtc(summary.phaseEnd) || empty(NOT_SET) },
];

export const certificateExpiresFact = (expires: string): FactRow => ({
  label: 'Certificate Expires',
  value: longDateUtc(expires),
});

/** No row at all when nothing is open or upcoming; spread it into the status list. */
export function engagementFact(engagement: ProjectEngagement | null): FactRow[] {
  if (!engagement) return [];
  return [
    {
      label: LABEL.engagement,
      value:
        engagement.state === 'open'
          ? `Open until ${pacificLongDay(engagement.period.dateCompleted)}`
          : pacificLongDay(engagement.period.dateStarted),
    },
  ];
}
