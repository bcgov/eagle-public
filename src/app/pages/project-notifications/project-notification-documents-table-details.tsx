import { Link } from 'react-router';
import { newlines } from 'app/utils/newlines';
import { safeHtml } from 'app/utils/safe-html';

function decisionText(rowData: any): string {
  const decision = rowData.decision || '-';
  const dateStr = rowData.decisionDate?.toString().split('T')[0];
  return dateStr
    ? `Notification Decision - ${decision} | ${dateStr}`
    : `Notification Decision - ${decision}`;
}

function getTrigger(project: any): string | null {
  return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
}

export function ProjectNotificationDocumentsTableDetails({ rowData }: { rowData: any }) {
  return (
    <div>
      <div className="row mb-3 mt-2">
        <div className="col-12">
          <h4>{rowData.name?.toUpperCase() || '-'}</h4>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="pn-decision">
            {rowData.associatedProjectId ? (
              <Link to={`/p/${rowData.associatedProjectId}`}>
                <p className="value">{decisionText(rowData)}</p>
              </Link>
            ) : (
              <p className="value">{decisionText(rowData)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12 pn-info-block">
          <span className="info-label">Description:</span>
          <p
            className="value"
            dangerouslySetInnerHTML={safeHtml(newlines(rowData.description || '-'))}
          ></p>
        </div>
      </div>

      <div className="row">
        <div className="col-sm-12 col-md-4 pn-info-block">
          <span className="info-label">Type</span>
          <p className="value">{rowData.type || '-'}</p>
        </div>
        <div className="col-sm-12 col-md-4 pn-info-block">
          <span className="info-label">Location</span>
          <p className="value">{rowData.location || '-'}</p>
        </div>
        <div className="col-sm-12 col-md-4 pn-info-block">
          <span className="info-label">Proponent</span>
          <p className="value">{rowData.proponent || '-'}</p>
        </div>
        <div className="col-sm-12 col-md-4 pn-info-block">
          <span className="info-label">Sub-Type</span>
          <p className="value">{rowData.subType || '-'}</p>
        </div>
        <div className="col-sm-12 col-md-4 pn-info-block">
          <span className="info-label">Region</span>
          <p className="value">{rowData.region || '-'}</p>
        </div>
        <div className="col-sm-12 col-md-4 pn-info-block">
          <span className="info-label">Notification Trigger</span>
          <p className="value">{getTrigger(rowData) || '-'}</p>
        </div>
      </div>
    </div>
  );
}
