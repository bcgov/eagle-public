import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Project } from 'app/models/project';
import { getAllByProjectId } from 'app/api/commentperiod';
import { periodsOf } from 'app/components/use-comment-periods';
import { track } from 'app/analytics/analytics';
import { logger } from 'app/config/logging';
import { safeHtml } from 'app/utils/safe-html';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import './proj-detail-popup.css';

interface ProjDetailPopupProps {
  project: Project;
  onClose?: () => void;
  /** `inline` drops the title, meta line and close button: the list card above the body is both. */
  variant?: 'popup' | 'inline';
}

export function ProjDetailPopup({ project, onClose, variant = 'popup' }: ProjDetailPopupProps) {
  const inline = variant === 'inline';
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  // Tagged with the project it belongs to, so the previous project's status never shows here.
  const [loaded, setLoaded] = useState<{ id: string; status: string } | null>(null);
  // Tagged with its project, so the card collapses again when the visitor picks another pin.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const commentPeriodStatus = loaded?.id === project?._id ? loaded.status : '';
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
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      origin?.focus();
    };
  }, [inline]);

  useEffect(() => {
    if (!project?._id) return;
    // The popup is reused as the visitor clicks from marker to marker, so a request for the
    // previous project must not land on the new one.
    const controller = new AbortController();
    const projId = project._id;

    getAllByProjectId(projId)
      .then((res) => {
        if (controller.signal.aborted) return;
        const status = periodsOf(res)[0]?.commentPeriodStatus;
        if (status) setLoaded({ id: projId, status });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          logger.error('Error loading comment period', 'ProjDetailPopup', error);
        }
      });

    return () => controller.abort();
  }, [project?._id]);

  function navigateToProject(): void {
    if (!project?._id) return;
    track('Project Viewed', {
      project_id: project._id,
      project_name: project.name,
      source: 'map_popup',
    });
    navigate(`/p/${project._id}`);
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

  return (
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
            {commentPeriodStatus === 'Open' && (
              <span className="chip chip--open">Open for comment</span>
            )}
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
  );
}
