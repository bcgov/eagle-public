import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CommentPeriodCards } from 'app/components/comment-period-card';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import { CommentPeriod } from 'app/models/commentperiod';
import type { TableRowProps } from 'app/components/table/table-object';
import { useResponsive } from 'app/state/responsive';
import { openExternal } from 'app/utils/safe-url';
import { ProjectNotificationDocumentsTable } from './project-notification-documents-table';
import { ProjectNotificationDocumentsTableDetails } from './project-notification-documents-table-details';
import './project-notifications-table-rows.css';

type Tab = 'details' | 'documents' | 'commenting';

function cpStatus(pcp: string): string {
  if (!pcp || pcp === 'none') return '';
  if (pcp === 'pending') return 'Upcoming';
  return pcp.charAt(0).toUpperCase() + pcp.slice(1);
}

/** Stands in for a notification whose comment period only exists as fields on the row itself. */
function fallbackPeriod(rowData: any): CommentPeriod {
  const period = new CommentPeriod({
    _id: rowData._id,
    project: rowData._id,
    isMet: rowData.isMet,
    metURL: rowData.metURL,
    dateStarted: rowData.dateStarted,
    dateCompleted: rowData.dateCompleted,
    instructions: 'Public Comment Period',
    additionalText: '',
  });

  period.commentPeriodStatus = cpStatus(rowData.pcp);
  if (
    period.commentPeriodStatus === 'Open' &&
    (!period.daysRemaining ||
      period.daysRemaining === 'Completed' ||
      period.daysRemaining === 'None')
  ) {
    period.daysRemaining = 'Active';
  }
  return period;
}

export function ProjectNotificationsTableRow({ rowData }: TableRowProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [documentsTabLoaded, setDocumentsTabLoaded] = useState(false);
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  const hasPcp = !!rowData?.pcp && rowData.pcp !== 'none';
  // Records predating the pcp field need a lookup to know whether they have any comment periods.
  // One query serves both that check and the tab body, so opening the tab costs no second request.
  const needsLookup = !!rowData?._id && (rowData.pcp === undefined || activeTab === 'commenting');

  const { data, isPending } = useCommentPeriods(rowData?._id, needsLookup);

  const commentPeriods = data?.length === 0 && hasPcp ? [fallbackPeriod(rowData)] : data;
  const showCommentingTab = hasPcp || (commentPeriods?.length ?? 0) > 0;

  function selectTab(tab: Tab): void {
    setActiveTab(tab);
    if (tab === 'documents') {
      setDocumentsTabLoaded(true);
    }
  }

  function goToCP(commentPeriod: CommentPeriod): void {
    if (commentPeriod.isMet && commentPeriod.metURL) {
      openExternal(commentPeriod.metURL);
    } else if (rowData?.associatedProjectId) {
      navigate(`/p/${rowData.associatedProjectId}/cp/${commentPeriod._id}`);
    } else if (rowData?._id) {
      navigate(`/pn/${rowData._id}/cp/${commentPeriod._id}`);
    }
  }

  function tabPaneClass(tab: Tab): string {
    return `tab-pane fade${activeTab === tab ? ' show active' : ''}`;
  }

  return (
    <tr>
      <td className="pn-location-info">
        <div className="pn-content-wrapper">
          <div className="tabs-container">
            <ul className="nav nav-tabs" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link${activeTab === 'details' ? ' active' : ''}`}
                  onClick={() => selectTab('details')}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'details'}
                >
                  {isMobile ? 'Details' : 'Project Notification Details'}
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link${activeTab === 'documents' ? ' active' : ''}`}
                  onClick={() => selectTab('documents')}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'documents'}
                >
                  Documents
                </button>
              </li>
              {showCommentingTab && (
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link${activeTab === 'commenting' ? ' active' : ''}`}
                    onClick={() => selectTab('commenting')}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'commenting'}
                  >
                    Engagement
                  </button>
                </li>
              )}
            </ul>

            <div className="tab-content">
              <div className={tabPaneClass('details')} role="tabpanel">
                <div className="tab-section">
                  <ProjectNotificationDocumentsTableDetails rowData={rowData} />
                </div>
              </div>

              <div className={tabPaneClass('documents')} role="tabpanel">
                {documentsTabLoaded && (
                  <div className="tab-section">
                    <ProjectNotificationDocumentsTable
                      header={rowData.name?.toUpperCase() || '-'}
                      tableId={rowData._id}
                      backgroundColor="transparent"
                      rowBackgroundColor="#F7F8FA"
                    />
                  </div>
                )}
              </div>

              {showCommentingTab && (
                <div className={tabPaneClass('commenting')} role="tabpanel">
                  <div className="tab-section pn-info-block py-2">
                    <CommentPeriodCards
                      periods={commentPeriods}
                      loading={needsLookup && isPending}
                      emptyMessage="No comment periods are currently scheduled for this project notification."
                      onOpen={goToCP}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
