import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useProjectEaCertificate, useProjectPhases } from 'app/api/project-phases';
import type { Project } from 'app/models/project';
import { AssessmentRail, TimelineLinks } from './assessment-rail';
import { useRailStages } from './assessment-stages';
import { Fact } from './project-panel';
import type { StandingDecision } from './project-standing';
import { decisionDateFormat, type FactRow, type SummaryPieceProps } from './summary-facts';

export function SkeletonBox({ labels }: { labels: string[] }) {
  return (
    <dl className="project-summary__box">
      {labels.map((label) => (
        <Fact key={label} label={label} loading />
      ))}
    </dl>
  );
}

function FactBox({ facts }: { facts: FactRow[] }) {
  return (
    <dl className="project-summary__box">
      {facts.map(({ loading = false, ...fact }) => (
        <Fact key={fact.label} {...fact} loading={loading} />
      ))}
    </dl>
  );
}

/** Project facts, the status facts behind a divider when any, then the phase text. */
export function SummaryGrid({
  facts,
  status,
  statusPending = false,
  description = null,
}: {
  facts: FactRow[];
  status: FactRow[];
  /** The comment periods are in flight: the status rows hold as placeholders. */
  statusPending?: boolean;
  description?: string | null;
}) {
  return (
    <div className="project-summary__grid">
      <FactBox facts={facts} />
      {status.length === 0 ? (
        <div className="project-summary__status-empty" />
      ) : statusPending ? (
        <SkeletonBox labels={status.map((fact) => fact.label)} />
      ) : (
        <FactBox facts={status} />
      )}
      <PhaseDescription text={description} />
    </div>
  );
}

/** The decision a project past its EA rests on, as one sentence: name, date, certificate. */
export function DecisionLine({ decision, projId }: { decision: StandingDecision; projId: string }) {
  const certificate = useProjectEaCertificate(projId);
  const date = decision.date ? decisionDateFormat(decision)(decision.date) : null;
  return (
    <SummaryLine>
      <strong>Decision</strong>: {decision.name}
      {date && <> on {date}</>}
      {certificate && (
        <>
          {' '}
          (<Link to={`/p/${projId}/decisions`}>{certificate}</Link>)
        </>
      )}
    </SummaryLine>
  );
}

/** The one sentence under the heading. */
export function SummaryLine({ children }: { children: ReactNode }) {
  return <p className="project-summary__line">{children}</p>;
}

/** One row: the heading over at most one sentence, then the Act and the timeline link. */
export function SummaryHead({
  heading,
  project,
  children,
}: {
  heading: string | null;
  project: Project | null;
  children?: ReactNode;
}) {
  if (!heading && !children && !project) return null;
  return (
    <div className="project-summary__head">
      <div className="project-summary__title">
        {heading && <h2 className="project-summary__heading">{heading}</h2>}
        {children}
      </div>
      {project && <TimelineLinks project={project} />}
    </div>
  );
}

/** The Act's stages under the head row, current at Eagle's phase. */
export function SummaryAssessmentRail({
  project,
  projId,
  lists,
  listsLoading,
}: Omit<SummaryPieceProps, 'summary'>) {
  const stages = useRailStages(project, lists, useProjectPhases(projId));
  return <AssessmentRail project={project} stages={stages} loading={listsLoading} headless />;
}

/** The third column, held open when empty so the facts keep their shape. */
function PhaseDescription({ text }: { text: string | null }) {
  if (!text) {
    return <div className="project-summary__description project-summary__description--empty" />;
  }
  return (
    <dl className="project-summary__description">
      <Fact label="Phase Description" value={text} loading={false} />
    </dl>
  );
}
