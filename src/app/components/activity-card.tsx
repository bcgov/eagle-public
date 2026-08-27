import { Link, useNavigate } from 'react-router';
import { track } from 'app/analytics/analytics';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import { safeHtml } from 'app/utils/safe-html';
import { longDate } from 'app/utils/utils';
import './activity-card.css';

interface ActivityCardProps {
  rowData: any;
  /** Renders the date in its own column, as the table layout does. */
  tableMode?: boolean;
  /** Controls "Project Info" button visibility. */
  showProjectInfo?: boolean;
}

function isSingleDoc(item: any): boolean {
  return item !== '' && item !== null && item !== undefined;
}

export function ActivityCard({ rowData, tableMode = false, showProjectInfo = true }: ActivityCardProps) {
  const navigate = useNavigate();

  function goToCP(activity: any): void {
    track('News Item Clicked', {
      activity_type: activity.type,
      project_id: activity.project?._id,
      project_name: activity.project?.name,
      has_comment_period: !!activity.pcp,
      is_met: activity.pcp?.isMet || false
    });
    if (activity.pcp?.isMet && activity.pcp?.metURL) {
      window.open(activity.pcp.metURL, '_blank');
    } else {
      navigate(`/p/${activity.project._id}/cp/${activity.pcp._id}`);
    }
  }

  return (
    <tr>
      <td className="activity-card col-10" tabIndex={0}>
        <div className="activity-card__meta mb-2">
          {rowData?.project?.name && <div className="activity-card__project-name">{rowData.project.name}</div>}
          {rowData?.notificationName && <div className="activity-card__project-name">{rowData.notificationName}</div>}
          {rowData?.projectNotification?.name && (
            <div className="activity-card__project-name">{rowData.projectNotification.name}</div>
          )}
          <div className="activity-card__headline">{rowData?.headline}</div>
        </div>

        {!tableMode && <small className="d-block text-muted mb-3">{longDate(rowData?.dateAdded)}</small>}

        <div className="mb-3 lh-base" dangerouslySetInnerHTML={safeHtml(sanitizeWordHtml(rowData?.content))}></div>

        <div className="d-flex flex-wrap gap-2">
          {rowData?.type === 'Project Notification News' && (
            <Link className="btn btn-sm btn-outline-primary" to="/project-notifications">
              View Project Notifications Page
            </Link>
          )}
          {showProjectInfo && rowData?.type !== 'Project Notification News' && rowData?.project?._id && (
            <Link
              className="btn btn-sm btn-outline-primary"
              to={`/p/${rowData.project._id}`}
              title={`View more information about ${rowData.project.name}`}
            >
              Project Info
            </Link>
          )}
          {rowData?.pcp && rowData?.type === 'Public Comment Period' && (
            <button className="btn btn-sm btn-outline-primary" onClick={() => goToCP(rowData)}>
              View Engagement
            </button>
          )}
          {isSingleDoc(rowData?.documentUrl) && !rowData?.documentUrl?.includes('docs?folder') && (
            rowData?.notificationName && rowData?.type === 'Project Notification Public Comment Period' ? (
              <a className="btn btn-sm btn-outline-primary" href={rowData.documentUrl} target="_blank" rel="noopener">
                View Project Notification Public Comment Period
              </a>
            ) : !rowData?.notificationName ? (
              <a className="btn btn-sm btn-outline-primary" href={rowData.documentUrl} target="_blank" rel="noopener">
                View Document(s)
              </a>
            ) : null
          )}
        </div>
      </td>

      {tableMode && (
        <td className="col-2 activity-card__date" tabIndex={0}>
          {longDate(rowData?.dateAdded)}
        </td>
      )}
    </tr>
  );
}
