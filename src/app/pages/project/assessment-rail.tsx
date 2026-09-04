import { useMemo, useState, type CSSProperties } from 'react';
import type { Project } from 'app/models/project';
import {
  AMENDMENT_STAGE,
  DETAILED_STAGES,
  EAO_DAYS,
  RAIL_DEFAULT_VIEW,
  SHOW_RATIFICATION_STRIPES,
  TOTAL_DAYS,
  YEAR_TICKS,
  detailedStages,
  durationLabel,
  inkFor,
  layout,
  simplifiedStages,
  type LaidStage,
  type PhaseListItem,
  type RailStage,
} from './assessment-stages';
import './assessment-rail.css';

interface AssessmentRailProps {
  project: Project | null;
  lists: PhaseListItem[];
}

/** CSS custom properties are not in React's `CSSProperties`, so they need the cast. */
function vars(properties: Record<string, string | number>): CSSProperties {
  return properties as CSSProperties;
}

function fill(stage: RailStage): string {
  return `var(${stage.token}, ${stage.hex})`;
}

function clockLabel(stage: LaidStage): string {
  return stage.owner === 'proponent'
    ? `${durationLabel(stage.days)} proponent time`
    : `${durationLabel(stage.days)} EAO limit`;
}

function stageTitle(stage: LaidStage): string {
  const clock =
    stage.owner === 'proponent'
      ? `${durationLabel(stage.days)}, proponent time (no EAO time limit)`
      : `${durationLabel(stage.days)}, legislated EAO time`;
  return `${stage.name} — ${clock}${stage.provisional ? ' · pending Comms ratification' : ''}`;
}

function SimpleRail({ stages }: { stages: RailStage[] }) {
  return (
    <ol className="assessment-rail__simple">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className={`assessment-rail__phase assessment-rail__phase--${stage.state}`}
          style={vars({ '--stage': fill(stage) })}
          aria-current={stage.state === 'current' ? 'step' : undefined}
          title={stage.name}
        >
          <span className="assessment-rail__phase-bar" aria-hidden="true" />
          <span className="assessment-rail__phase-name">{stage.name}</span>
          {stage.dates && <span className="assessment-rail__phase-dates">{stage.dates}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * The project's place in the environmental assessment process, as the familiar seven-stage
 * rail or - on 2018 Act projects - a to-scale timeline of the ten statutory stages.
 */
export function AssessmentRail({ project, lists }: AssessmentRailProps) {
  const [view, setView] = useState(RAIL_DEFAULT_VIEW);
  const [hoverStage, setHoverStage] = useState<number | null>(null);

  const simple = useMemo(() => simplifiedStages(lists, project), [lists, project]);
  const laid = useMemo(() => layout(detailedStages(project)), [project]);

  const canDetail = String(project?.legislation ?? '').includes('2018');
  const detailed = canDetail && view === 'detailed';
  const showAmendment = String(project?.currentPhaseName?.name ?? '').startsWith('Post Decision');

  const proponentDays = (TOTAL_DAYS - EAO_DAYS).toLocaleString('en-CA');
  const totalYears = (TOTAL_DAYS / 365).toFixed(1);
  const eaoShare = Math.round((EAO_DAYS / TOTAL_DAYS) * 100);

  return (
    <section className="assessment-rail" aria-labelledby="assessment-rail-heading">
      <div className="assessment-rail__head">
        <h2 id="assessment-rail-heading" className="assessment-rail__title">
          Assessment progress
        </h2>
        {canDetail && (
          <div className="assessment-rail__views" role="group" aria-label="Progress detail">
            <button
              type="button"
              className="assessment-rail__view"
              aria-pressed={!detailed}
              onClick={() => setView('simple')}
            >
              Simplified
            </button>
            <button
              type="button"
              className="assessment-rail__view"
              aria-pressed={detailed}
              onClick={() => setView('detailed')}
            >
              Detailed
            </button>
          </div>
        )}
      </div>

      {!detailed && <SimpleRail stages={simple} />}

      {detailed && (
        <div className="assessment-rail__detail">
          <div className="assessment-rail__scale">
            <div className="assessment-rail__track">
              <div className="assessment-rail__axis" aria-hidden="true">
                {YEAR_TICKS.map((tick) => (
                  <span
                    key={tick.label}
                    className="assessment-rail__tick"
                    style={vars({ '--l': `${tick.left.toFixed(2)}%` })}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>

              <ol className="assessment-rail__bar">
                {laid.map((stage) => (
                  <li
                    key={stage.id}
                    className={`assessment-rail__seg${
                      SHOW_RATIFICATION_STRIPES && stage.provisional
                        ? ' assessment-rail__seg--striped'
                        : ''
                    }`}
                    data-stage={stage.n}
                    data-hover={hoverStage === stage.n || undefined}
                    style={vars({
                      '--l': `${stage.start.toFixed(2)}%`,
                      '--w': stage.width.toFixed(2),
                      '--stage': fill(stage),
                    })}
                    title={stageTitle(stage)}
                    onMouseEnter={() => setHoverStage(stage.n)}
                    onMouseLeave={() => setHoverStage(null)}
                  />
                ))}
              </ol>

              <ul className="assessment-rail__pins" aria-hidden="true">
                {laid.map((stage) => (
                  <li
                    key={stage.id}
                    className="assessment-rail__num assessment-rail__pin"
                    data-stage={stage.n}
                    data-hover={hoverStage === stage.n || undefined}
                    style={vars({
                      '--l': `${(stage.start + stage.width / 2).toFixed(2)}%`,
                      '--stage': fill(stage),
                      '--ink': inkFor(stage.hex),
                    })}
                    onMouseEnter={() => setHoverStage(stage.n)}
                    onMouseLeave={() => setHoverStage(null)}
                  >
                    {stage.n}
                  </li>
                ))}
              </ul>
            </div>

            {showAmendment && (
              <>
                <div className="assessment-rail__gap" aria-hidden="true" />
                <div
                  className="assessment-rail__amendment"
                  style={vars({ '--stage': fill(AMENDMENT_STAGE) })}
                >
                  <span className="assessment-rail__amendment-bar" aria-hidden="true" />
                  <span className="assessment-rail__amendment-name">{AMENDMENT_STAGE.name}</span>
                  <span className="assessment-rail__amendment-note">
                    In progress · no legislated duration
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ponytail: white numerals sit at 4.11:1 on #54858d and dark ink at 4.17:1 on #da6d65,
              so the key text, not the numeral, has to carry the meaning. */}
          <ol className="assessment-rail__key">
            {laid.map((stage) => (
              <li
                key={stage.id}
                className={`assessment-rail__key-row assessment-rail__key-row--${stage.owner}`}
                data-stage={stage.n}
                data-hover={hoverStage === stage.n || undefined}
                onMouseEnter={() => setHoverStage(stage.n)}
                onMouseLeave={() => setHoverStage(null)}
              >
                <span
                  className="assessment-rail__num assessment-rail__chip"
                  style={vars({ '--stage': fill(stage), '--ink': inkFor(stage.hex) })}
                >
                  {stage.n}
                </span>
                <span className="assessment-rail__key-text">
                  <span className="assessment-rail__key-name" title={stageTitle(stage)}>
                    {stage.name}
                  </span>
                  <span className="assessment-rail__key-clock">
                    {clockLabel(stage)}
                    {stage.dates ? ` · ${stage.dates}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <p className="assessment-rail__caption">
            Bar widths are drawn to scale against the maximum timeline of {totalYears} years. Of
            that, {EAO_DAYS} days ({eaoShare}%) are legislated time limits on the EAO; the remaining{' '}
            {proponentDays} days are proponent time, which the Act does not cap the same way.
          </p>

          {SHOW_RATIFICATION_STRIPES && DETAILED_STAGES.some((stage) => stage.provisional) && (
            <p className="assessment-rail__legend">
              <span className="assessment-rail__legend-swatch" aria-hidden="true" />
              Striped stages are pending Comms ratification
            </p>
          )}
        </div>
      )}
    </section>
  );
}
