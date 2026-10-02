import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { logger } from 'app/config/logging';
import type { Project } from 'app/models/project';
import { explorerLink } from 'app/pages/projects/explorer-link';
import { Fact as FactRow, type PanelParts } from '../project-panel';
import { StepStatus } from './blocks/timeline-block';
import { RichTextView } from './rich-text';
import { extendedSteps } from './extended-page';
import type { ExtendedMap, ExtendedPage, ExtendedTimeline, Fact } from './types';
import './extended.css';
import './extended-shell.css';

// maplibre-gl is ~1 MB; keep it out of the main bundle until the thumbnail renders.
const RouteMapThumbnail = lazy(() =>
  import('./route-map').then((m) => ({ default: m.RouteMapThumbnail })),
);

/**
 * A route map that fails (its chunk stale after a deploy, say) shows `fallback` in its place, and
 * the rest of the page keeps rendering.
 */
export class RouteMapBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    logger.error('The route map could not load', 'RouteMapBoundary', error);
  }

  override render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** The gold pill above a listed project's title. */
export function MastheadBadge({ label }: { label: string }) {
  return (
    <p className="extended-badge">
      <i className="material-icons" aria-hidden="true">
        flag
      </i>
      {label}
    </p>
  );
}

/** The page's timeline steps. Not to scale: the steps carry no durations like the EAO's. */
function TimelineRail({ timeline }: { timeline: ExtendedTimeline }) {
  return (
    <div className="extended-rail">
      <div className="extended-rail__head">
        <h2 className="extended-rail__title">{timeline.title}</h2>
        <p className="extended-rail__note extended-copy">
          <RichTextView text={timeline.note} />
        </p>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ol className="extended-rail__steps" role="list">
        {extendedSteps(timeline).map((step) => (
          <li
            key={step.name}
            className={`extended-rail__step extended-rail__step--${step.state}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className="extended-rail__bar" aria-hidden="true" />
            <span className="extended-rail__name">{step.name}</span>
            <span className="extended-rail__date">
              <StepStatus timeline={timeline} step={step} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The content's facts, in place of the record facts. */
function ExtendedFacts({ facts }: { facts: Fact[] }) {
  return (
    // extended-copy underlines the links in the facts.
    <dl className="extended-copy extended-panel__facts">
      {facts.map((fact) => (
        <FactRow
          key={fact.label}
          label={fact.label}
          value={
            <>
              {fact.statusDot && <span className="extended-panel__status-dot" aria-hidden="true" />}
              <RichTextView text={fact.value} />
            </>
          }
          detail={fact.detail && <RichTextView text={fact.detail} />}
          loading={false}
        />
      ))}
    </dl>
  );
}

/** A thumbnail of the content's map, in place of the location map. */
function ExtendedPanelMap({
  map,
  label,
  caption,
  project,
}: {
  map: ExtendedMap;
  label: string;
  caption: string;
  project: Project | null;
}) {
  return (
    <div className="project-panel__map extended-panel__map">
      <div className="map-container extended-panel__thumbnail">
        <RouteMapBoundary
          fallback={<p className="extended-panel__map-unavailable">The map could not be loaded.</p>}
        >
          <Suspense fallback={<Skeleton height="100%" />}>
            <RouteMapThumbnail map={map} label={label} />
          </Suspense>
        </RouteMapBoundary>
      </div>
      <p className="extended-panel__map-caption">{caption}</p>
      <Link className="project-panel__map-link" to={explorerLink(project)}>
        <span className="link-label">Open in map explorer</span>
        <span className="material-icons" aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </div>
  );
}

/**
 * The panel parts an extended project page draws in place of the standard ones: the timeline, its
 * facts and a thumbnail of its map, each only when `panel` asks for it. The rest stay standard.
 */
// eslint-disable-next-line react-refresh/only-export-components -- builds the panel's parts, not a component
export function extendedPanelParts(
  content: ExtendedPage,
  /** The Eagle record behind the page; null while it loads, which links the plain explorer. */
  project: Project | null,
): PanelParts {
  const { panel, timeline, map } = content;
  return {
    progress: panel?.timeline && timeline ? <TimelineRail timeline={timeline} /> : undefined,
    facts: panel?.facts ? <ExtendedFacts facts={panel.facts} /> : undefined,
    map:
      panel?.map && map ? (
        <ExtendedPanelMap
          map={map}
          label={panel.map.label}
          caption={panel.map.caption}
          project={project}
        />
      ) : undefined,
  };
}
