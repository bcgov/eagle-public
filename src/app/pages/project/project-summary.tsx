import type { ReactNode } from 'react';
import { useProjectEaCertificate, useProjectPhases } from 'app/api/project-phases';
import { ExternalLink } from 'app/components/external-link';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { actFor } from 'app/utils/legislation';
import { longDate, longDateUtc } from 'app/utils/utils';
import { AssessmentRail } from './assessment-rail';
import type { PhaseListItem } from './assessment-stages';
import { eaDecisionDetail } from './ea-decision-detail';
import { Fact } from './project-panel';
import { UNDECIDED } from './use-project-tab-meta';
import type { StandingDecision } from './project-standing';
import { useProjectSummary } from './use-project-summary';
import './project-summary.css';

interface ProjectSummaryProps {
  project: Project | null;
  projId: string;
  /** Every List row; the rail picks the projectPhase ones out. */
  lists: PhaseListItem[];
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
  /** The List rows are still in flight; only the rail waits on them. */
  listsLoading?: boolean;
}

interface FactRow {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

const SKELETON_FACTS = ['Project Category', 'Entered the EA Process', 'Legislation'];
const SKELETON_PHASE_FACTS = ['Phase Start', 'Anticipated Phase End', 'Next Public Engagement'];

function SkeletonBox({ labels }: { labels: string[] }) {
  return (
    <dl className="project-summary__box">
      {labels.map((label) => (
        <Fact key={label} label={label} loading />
      ))}
    </dl>
  );
}

/** One bordered box of the facts grid, left out when none of its facts has a value. */
function FactBox({ facts }: { facts: FactRow[] }) {
  const shown = facts.filter((fact) => fact.value);
  if (!shown.length) return null;
  return (
    <dl className="project-summary__box">
      {shown.map((fact) => (
        <Fact key={fact.label} {...fact} loading={false} />
      ))}
    </dl>
  );
}

/** The decision a project past its EA rests on: name, then date and certificate. */
function DecisionBadge({
  decision,
  eaCertificate,
  projId,
}: {
  decision: StandingDecision;
  eaCertificate: string | undefined;
  projId: string;
}) {
  const format = decision.source === 'track' ? longDateUtc : longDate;
  const detail = eaDecisionDetail(decision.date ?? undefined, eaCertificate, projId, format);
  return (
    <p className="project-summary__badge">
      <span className="project-summary__badge-label">Decision</span> {decision.name}
      {detail && <> · {detail}</>}
    </p>
  );
}

/** A standard project's summary under the masthead: work and phase, the rail, then the facts. */
export function ProjectSummary({
  project,
  projId,
  lists,
  loading = false,
  listsLoading = false,
}: ProjectSummaryProps) {
  const summary = useProjectSummary(projId, project);
  const phases = useProjectPhases(projId);
  const eaCertificate = useProjectEaCertificate(projId);
  // Box 2 holds its skeleton until its sources settle, so it does not pop in under box 1.
  const phaseBoxPending = loading || summary.periodsPending;

  const href = actFor(summary.legislation ?? undefined)?.href;
  const kind = summary.standing?.standing;
  // Types 03 and 04 carry their decision in the badge, not the facts.
  const pastDecision = kind === 'decided' || kind === 'postDecisionWork';
  const decisionName = project?.eacDecision?.name;
  const hideDecision = pastDecision || decisionName === UNDECIDED;
  const decision = hideDecision ? null : decisionName;
  const badge = pastDecision && summary.standing?.decision && (
    <DecisionBadge
      decision={summary.standing.decision}
      eaCertificate={eaCertificate}
      projId={projId}
    />
  );
  const engagement = summary.engagement;

  return (
    <section
      className={`project-summary${pastDecision ? ' project-summary--decided' : ''}`}
      aria-label="Project status"
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="visually-hidden">Loading project status</span>
          <div className="project-summary__head">
            <Skeleton width="40%" className="project-summary__head-skeleton" />
          </div>
        </>
      ) : (
        (summary.heading || badge) && (
          <div className="project-summary__head">
            {summary.heading && <h2 className="project-summary__heading">{summary.heading}</h2>}
            {badge}
          </div>
        )
      )}

      <AssessmentRail
        project={project}
        lists={lists}
        phases={phases}
        loading={loading || listsLoading}
      />

      <div className="project-summary__grid">
        {loading ? (
          <SkeletonBox labels={SKELETON_FACTS} />
        ) : (
          <FactBox
            facts={[
              { label: 'Project Category', value: summary.category },
              { label: 'Entered the EA Process', value: longDateUtc(summary.enteredOn) },
              {
                label: 'Legislation',
                value:
                  summary.legislation &&
                  (href ? (
                    <ExternalLink href={href}>{summary.legislation}</ExternalLink>
                  ) : (
                    summary.legislation
                  )),
              },
              {
                label: 'EA decision',
                value: decision,
                detail: eaDecisionDetail(project?.decisionDate, eaCertificate, projId),
              },
            ]}
          />
        )}
        {phaseBoxPending ? (
          <SkeletonBox labels={SKELETON_PHASE_FACTS} />
        ) : (
          <FactBox
            facts={[
              { label: 'Phase Start', value: longDateUtc(summary.phaseStart) },
              { label: 'Anticipated Phase End', value: longDateUtc(summary.phaseEnd) },
              {
                label: 'Next Public Engagement',
                value:
                  engagement &&
                  (engagement.state === 'open'
                    ? `Open until ${longDate(engagement.period.dateCompleted)}`
                    : longDate(engagement.period.dateStarted)),
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}
