import { DateTime } from 'luxon';
import { documentFilters } from 'app/api/document';
import { DocumentLink } from 'app/components/table/document-link';
import { useTable } from 'app/components/table/use-table';
import { Constants } from 'app/utils/constants';
import { documentTabByKey, idsForTerms, type ListTerm } from 'app/utils/document-tabs';
import type { StandingDecision } from './project-standing';
import { SummaryAssessmentRail, SummaryGrid, SummaryHead, SummaryLine } from './summary-parts';
import {
  decisionDateFormat,
  empty,
  NOT_SET,
  projectFacts,
  type FactRow,
  type SummaryPieceProps,
} from './summary-facts';

interface Exit {
  heading: string;
  /** The reason sentence, with the date when there is one. */
  reason: (date: string) => string;
  /** The `List` rows the reason document is filed under; the Certificate tab's types otherwise. */
  milestones?: ListTerm[];
}

const CLOSED = 'Project Closed';
const datedReason = (text: string) => (date: string) => (date ? `${text} on ${date}.` : `${text}.`);
const notNeeded = (date: string) =>
  date
    ? `The project did not need an environmental assessment (${date}).`
    : 'The project did not need an environmental assessment.';

const WITHDRAWN: Exit = {
  heading: 'Project Withdrawn',
  reason: datedReason('The proponent withdrew the project from the environmental assessment'),
  milestones: [{ name: 'Withdrawal', kind: 'label' }],
};
const TERMINATED: Exit = {
  heading: 'Project Terminated',
  reason: datedReason('The Environmental Assessment Office ended the assessment'),
  milestones: [{ name: 'Termination', kind: 'label' }],
};
const NOT_NEEDED: Exit = { heading: CLOSED, reason: notNeeded };

// Keys are the exit decisions in project-standing.ts.
const EXITS: Record<string, Exit> = {
  Withdrawn: WITHDRAWN,
  'Application Withdrawn': WITHDRAWN,
  Terminated: TERMINATED,
  'Assessment Terminated': TERMINATED,
  'Administrative Closure': {
    heading: CLOSED,
    reason: datedReason('The Environmental Assessment Office closed the project file'),
  },
  'Regulatory Transfer': {
    heading: 'Project Transferred',
    reason: datedReason('The project moved to another regulator'),
  },
  'Certificate Expired': {
    heading: 'Project Expired',
    reason: datedReason("The project's certificate expired"),
  },
  'Certificate Refused': {
    heading: 'Project Refused',
    reason: datedReason('The certificate was refused'),
  },
  'Certificate Cancelled': {
    heading: 'Project Cancelled',
    reason: datedReason("The project's certificate was cancelled"),
  },
  'Not Designated Reviewable': NOT_NEEDED,
  'Project Designated Non-Reviewable': NOT_NEEDED,
  'Certificate Not Required': NOT_NEEDED,
  'Certificate End of Life': {
    heading: CLOSED,
    reason: datedReason("The project's certificate reached its end of life"),
  },
};

const UNKNOWN_EXIT: Exit = { heading: CLOSED, reason: () => 'This project is closed.' };

const CERTIFICATE_TYPES =
  documentTabByKey(Constants.optionalProjectDocTabs.CERTIFICATE)?.types ?? [];

/** A document filed this many days before the decision still counts as its reason. */
const REASON_WINDOW_DAYS = 7;

/** First day a reason document may carry, in the zone the decision date was written in. */
function windowStart(decision: StandingDecision | null): string | null {
  if (!decision?.date) return null;
  const zone = decision.source === 'track' ? 'utc' : Constants.BC_ZONE;
  const day = DateTime.fromISO(decision.date, { zone });
  return day.isValid ? day.minus({ days: REASON_WINDOW_DAYS }).toFormat('yyyy-MM-dd') : null;
}

/** The newest document filed for the decision, from a week before it on. */
function useReasonFact(
  projId: string,
  exit: Exit,
  decision: StandingDecision | null,
  { lists, listsLoading }: Pick<SummaryPieceProps, 'lists' | 'listsLoading'>,
): FactRow | null {
  const ids = idsForTerms(exit.milestones ?? CERTIFICATE_TYPES, lists).join(',');
  const from = windowStart(decision);
  const enabled = !!projId && !!ids && !!from;
  const result = useTable('summaryReasonDocument', {
    projId,
    enabled,
    page: 1,
    pageSize: 1,
    sortBy: '-datePosted',
    filters: documentFilters(exit.milestones ? { milestone: ids } : { type: ids }, {
      datePostedStart: from,
    }),
  });
  const label = 'Reason for Decision';
  if (from && (listsLoading || result.initialLoading)) return { label, value: null, loading: true };
  const document = enabled ? result.data[0] : undefined;
  if (!document) return null;
  return {
    label,
    value: (
      <DocumentLink document={document}>
        {document.displayName || document.documentFileName || 'Open document'}
      </DocumentLink>
    ),
  };
}

/** Type 02, out of EAO regulation: why and when it left, the assessment as it ended, the facts. */
export function SummaryExited({
  summary,
  project,
  projId,
  lists,
  listsLoading,
}: SummaryPieceProps) {
  const decision = summary.standing?.decision ?? null;
  const exit = (decision && EXITS[decision.name]) || UNKNOWN_EXIT;
  const left = decision?.date ? decisionDateFormat(decision)(decision.date) : '';
  const reasonFact = useReasonFact(projId, exit, decision, { lists, listsLoading });

  return (
    <>
      <SummaryHead heading={exit.heading} project={project}>
        <SummaryLine>{exit.reason(left)}</SummaryLine>
      </SummaryHead>

      {/* Not in the type 02 mockup; kept so every type has a strip. */}
      <SummaryAssessmentRail
        project={project}
        projId={projId}
        lists={lists}
        listsLoading={listsLoading}
      />

      <SummaryGrid
        facts={projectFacts(summary)}
        status={[
          { label: 'Left the EA Process', value: left || empty(NOT_SET) },
          ...(reasonFact ? [reasonFact] : []),
        ]}
      />
    </>
  );
}
