import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Project } from 'app/models/project';
import { ENGAGEMENT_LABEL, type ProjectEngagement } from 'app/api/commentperiod';
import { EngagementLink } from 'app/components/engagement-link';
import {
  engageUrl,
  periodDates,
  periodDetailsHref,
  type CommentPeriod,
} from 'app/models/commentperiod';
import { track } from 'app/analytics/analytics';
import { safeHtml } from 'app/utils/safe-html';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import './proj-detail-popup.css';

interface ProjDetailPopupProps {
  project: Project;
  /** The project's open or upcoming comment period, drawn as the banner above the card. */
  engagement?: ProjectEngagement;
  onClose?: () => void;
  /** `inline` drops the title, meta line and close button: the list card above the body is both. */
  variant?: 'popup' | 'inline';
}

export function ProjDetailPopup({
  project,
  engagement,
  onClose,
  variant = 'popup',
}: ProjDetailPopupProps) {
  const inline = variant === 'inline';
  const source = inline ? 'list_accordion' : 'map_popup';
  const navigate = useNavigate();
  const bannerTitleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bannerRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  // Tagged with its project, so the card collapses again when the visitor picks another pin.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expanded = expandedId === project?._id;

  // The Escape listener is registered once, so it reads the current handler through this ref.
  useEffect(() => {
    closeRef.current = onClose;
  });

  // The card opens over the map, takes focus and closes on Escape. The inline body is an accordion
  // panel instead: the card button that opened it keeps focus and toggles it.
  useEffect(() => {
    if (inline) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The banner sits above the heading, so starting there keeps its link on the Tab path.
    (bannerRef.current ?? headingRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      origin?.focus();
    };
  }, [inline]);

  function navigateToProject(): void {
    if (!project?._id) return;
    track('Project Viewed', {
      project_id: project._id,
      project_name: project.name,
      source: 'map_popup',
    });
    navigate(`/p/${project._id}`);
  }

  function trackEngagementClick(period: CommentPeriod): void {
    const external = !!engageUrl(period);
    track('Comment Period Banner Clicked', {
      project_id: project._id,
      project_name: project.name,
      status: period.commentPeriodStatus,
      is_met: external,
      destination: external ? 'external_met' : 'comment_period_details',
      source,
    });
  }

  if (!project) return null;

  const phase: string = project.currentPhaseName?.name ?? '';
  const description = String(project.description ?? '');
  // ponytail: length heuristic instead of measuring the box; swap for a ResizeObserver if the
  // toggle ever shows on a description that turns out to fit.
  const clampable = description.replace(/<[^>]*>/g, '').length > 200;
  const meta = [project.proponent?.name, [project.type, project.sector].filter(Boolean).join(' / ')]
    .filter(Boolean)
    .join(' · ');
  const eaCertificate = typeof project.eaCertificate === 'string' ? project.eaCertificate : '';
  const engagementDates = engagement ? periodDates(engagement.period) : '';
  const engagementLabel = engagement ? ENGAGEMENT_LABEL[engagement.state] : '';
  // Same wording as the project overview's callout.
  const engagementCta =
    engagement && !engageUrl(engagement.period) && engagement.state === 'upcoming'
      ? 'View comment period'
      : (engagement?.period.bannerCTA ?? '');

  return (
    <div className={`popup-stack${inline ? ' popup-stack--inline' : ''}`}>
      {engagement && (
        <section
          className={`popup-engagement popup-engagement--${engagement.state}`}
          tabIndex={-1}
          ref={bannerRef}
          aria-labelledby={bannerTitleId}
        >
          {/* A paragraph, not a heading: it sits above the card's h2. */}
          <p className="popup-engagement__title" id={bannerTitleId}>
            {engagementLabel.charAt(0).toUpperCase() + engagementLabel.slice(1)}
          </p>
          {engagementDates && <p className="popup-engagement__dates">{engagementDates}</p>}
          <EngagementLink
            className="popup-engagement__link"
            isMet={engagement.period.isMet}
            metURL={engagement.period.metURL}
            to={periodDetailsHref(engagement.period)}
            label={engagementCta}
            onClick={() => trackEngagementClick(engagement.period)}
          />
        </section>
      )}

      <div className={`popup-card${inline ? ' popup-card--inline' : ''}`}>
        <div className="popup-head">
          <div className="popup-head__row">
            <div className="popup-head__title">
              {!inline && (
                <h2 className="popup-title" tabIndex={-1} ref={headingRef}>
                  {project.name || '-'}
                </h2>
              )}
              {phase && !inline && <span className="chip">{phase}</span>}
            </div>
            {!inline && onClose && (
              <button type="button" className="popup-close" aria-label="Close" onClick={onClose}>
                <i className="material-icons" aria-hidden="true">
                  close
                </i>
              </button>
            )}
          </div>
          {!inline && meta && <p className="popup-subtitle">{meta}</p>}
        </div>

        <div className="popup-body">
          {description && (
            <>
              <div
                className={`popup-desc${clampable && !expanded ? ' is-clamped' : ''}`}
                dangerouslySetInnerHTML={safeHtml(sanitizeWordHtml(description))}
              />
              {clampable && (
                <button
                  type="button"
                  className="popup-more"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : project._id)}
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              )}
            </>
          )}

          <dl className="popup-meta">
            <dt>Region</dt>
            <dd>{project.region || '-'}</dd>
            <dt>EA decision</dt>
            <dd>{project.eacDecision?.name || '-'}</dd>
            {eaCertificate && (
              <>
                <dt>EA Certificate</dt>
                <dd>{eaCertificate}</dd>
              </>
            )}
            <dt>Location</dt>
            <dd>{project.location || '-'}</dd>
          </dl>
        </div>

        <div className="popup-foot">
          <button
            type="button"
            className="btn btn-primary btn-sm popup-view"
            onClick={navigateToProject}
          >
            View project
          </button>
        </div>
      </div>
    </div>
  );
}
