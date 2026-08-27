import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Project } from 'app/models/project';
import type { CommentPeriod } from 'app/models/commentperiod';
import { getAllByProjectId } from 'app/api/commentperiod';
import { track } from 'app/analytics/analytics';
import { logger } from 'app/config/logging';
import { safeHtml } from 'app/utils/safe-html';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import './proj-detail-popup.css';

function periodsOf(res: unknown): CommentPeriod[] {
  if (Array.isArray(res)) return res as CommentPeriod[];
  return (res as { data?: CommentPeriod[] })?.data ?? [];
}

export function ProjDetailPopup({ project }: { project: Project }) {
  const navigate = useNavigate();
  // Tagged with the project it belongs to, so the previous project's status never shows here.
  const [loaded, setLoaded] = useState<{ id: string; status: string } | null>(null);
  const commentPeriodStatus = loaded?.id === project?._id ? loaded.status : '';

  useEffect(() => {
    if (!project?._id) return;
    // The popup is reused as the visitor clicks from marker to marker, so a request for the
    // previous project must not land on the new one.
    const controller = new AbortController();
    const projId = project._id;

    getAllByProjectId(projId)
      .then(res => {
        if (controller.signal.aborted) return;
        const status = periodsOf(res)[0]?.commentPeriodStatus;
        if (status) setLoaded({ id: projId, status });
      })
      .catch(error => {
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
      source: 'map_popup'
    });
    navigate(`/p/${project._id}`);
  }

  if (!project) return null;

  return (
    <div className="popup-content">
      <div className="popup-title">
        <span className="client-name__label">Project</span>
        <span className="client-name__value">{project.name || '-'}</span>
      </div>
      <div className="popup-body">
        <div className="app-details">
          <div className="meta-container">
            <ul>
              {project.description && (
                <li className="app-description">
                  <div className="value" dangerouslySetInnerHTML={safeHtml(sanitizeWordHtml(project.description))} />
                </li>
              )}
              <li>
                <span className="key">Decision:</span>
                <span className="value">{project.eacDecision?.name || '-'}</span>
              </li>
              <li>
                <span className="key">Phase:</span>
                <span className="value">{project.currentPhaseName?.name || '-'}</span>
              </li>
              <li>
                <span className="key">Location:</span>
                <span className="value">{project.location || '-'}</span>
              </li>
              {commentPeriodStatus && (
                <li>
                  <span className="key">Comment Period Status:</span>
                  <span className="value">{commentPeriodStatus}</span>
                </li>
              )}
            </ul>
          </div>

          <hr />

          <a
            className="app-link btn btn-primary"
            onClick={navigateToProject}
            onKeyDown={event => {
              if (event.key === 'Enter') navigateToProject();
            }}
            tabIndex={0}
            role="button"
            style={{ cursor: 'pointer' }}
            title="View more information about this project"
          >
            View Project Details
          </a>
        </div>
      </div>
    </div>
  );
}
