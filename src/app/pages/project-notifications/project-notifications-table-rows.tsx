import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAllByProjectId, isClosed, isNotStarted, isOpen } from 'app/api/commentperiod';
import { CommentPeriod } from 'app/models/commentperiod';
import type { TableRowProps } from 'app/components/table/table-object';
import { useResponsive } from 'app/state/responsive';
import { openExternal } from 'app/utils/safe-url';
import { mediumDate } from 'app/utils/utils';
import { ProjectNotificationDocumentsTable } from './project-notification-documents-table';
import { ProjectNotificationDocumentsTableDetails } from './project-notification-documents-table-details';
import './project-notifications-table-rows.css';

type Tab = 'details' | 'documents' | 'commenting';

function cpStatus(pcp: string): string {
  if (!pcp || pcp === 'none') return '';
  if (pcp === 'pending') return 'Upcoming';
  return pcp.charAt(0).toUpperCase() + pcp.slice(1);
}

/**
 * Legacy comment periods carry the period name inside the instructions HTML, so it is pulled out
 * and the raw text kept as the description. Duplicates by id, and by MET URL for MET periods.
 */
function normalizePeriods(raw: CommentPeriod[]): CommentPeriod[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  return raw
    .map((element) => {
      const fullText = element.instructions
        ? element.instructions
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
      const match = fullText.match(/Comment Period on the (.*?) for /);
      element.additionalText = element.additionalText || fullText || element.informationLabel;
      element.instructions = match ? match[1] : '';
      return element;
    })
    .filter((period) => {
      if (seenIds.has(period._id)) return false;
      seenIds.add(period._id);
      if (period.isMet && period.metURL) {
        if (seenUrls.has(period.metURL)) return false;
        seenUrls.add(period.metURL);
      }
      return true;
    });
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

  const { data: periods, isPending } = useQuery({
    queryKey: ['commentPeriods', rowData?._id],
    enabled: needsLookup,
    queryFn: async () => {
      const res: any = await getAllByProjectId(rowData._id);
      const list: CommentPeriod[] = Array.isArray(res) ? res : (res?.data ?? []);
      const deduped = normalizePeriods(list);
      return deduped.length === 0 && hasPcp ? [fallbackPeriod(rowData)] : deduped;
    },
  });

  const showCommentingTab = hasPcp || (periods?.length ?? 0) > 0;
  const commentPeriods = needsLookup && isPending ? null : (periods ?? []);

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
                    {commentPeriods === null ? (
                      <div className="cp-card cp-card--skeleton">
                        <div className="cp-card__header">
                          <div
                            className="skeleton-cell"
                            style={{ width: '90px', height: '12px', borderRadius: '4px' }}
                          ></div>
                          <div
                            className="skeleton-cell"
                            style={{
                              width: '70px',
                              height: '20px',
                              borderRadius: '999px',
                              marginLeft: 'auto',
                            }}
                          ></div>
                        </div>
                        <div className="cp-card__body">
                          <div
                            className="skeleton-cell"
                            style={{
                              width: '55%',
                              height: '14px',
                              borderRadius: '4px',
                              marginBottom: '0.5rem',
                            }}
                          ></div>
                          <div
                            className="skeleton-cell"
                            style={{
                              width: '38%',
                              height: '11px',
                              borderRadius: '4px',
                              marginBottom: '0.5rem',
                            }}
                          ></div>
                          <div
                            className="skeleton-cell"
                            style={{ width: '88%', height: '11px', borderRadius: '4px' }}
                          ></div>
                        </div>
                      </div>
                    ) : commentPeriods.length < 1 ? (
                      <div className="py-2 px-3">
                        No comment periods are currently scheduled for this project notification.
                      </div>
                    ) : (
                      commentPeriods.map((cp) => (
                        <article className="card cp-card" key={cp._id}>
                          <div className="cp-card__header">
                            <span
                              className={`cp-card__status-dot${isOpen(cp) ? ' cp-card__status-dot--open' : ''}${
                                isNotStarted(cp) ? ' cp-card__status-dot--pending' : ''
                              }${isClosed(cp) ? ' cp-card__status-dot--closed' : ''}`}
                            ></span>
                            <span className="cp-card__status-label">{cp.commentPeriodStatus}</span>
                            {isOpen(cp) ? (
                              <span className="cp-card__pill cp-card__pill--open">
                                {cp.daysRemaining}
                              </span>
                            ) : isClosed(cp) ? (
                              <span className="cp-card__pill cp-card__pill--closed">
                                Closed {mediumDate(cp.dateCompleted)}
                              </span>
                            ) : isNotStarted(cp) ? (
                              <span className="cp-card__pill cp-card__pill--pending">
                                Starts {mediumDate(cp.dateStarted)}
                              </span>
                            ) : null}
                          </div>
                          <div className="cp-card__body">
                            <h3 className="cp-card__title">
                              {cp.informationLabel || cp.instructions || 'Public Comment Period'}
                            </h3>
                            {cp.dateStarted && (
                              <p className="cp-card__dates">
                                {mediumDate(cp.dateStarted)} – {mediumDate(cp.dateCompleted)}
                              </p>
                            )}
                            {cp.additionalText && (
                              <p className="cp-card__description">{cp.additionalText}</p>
                            )}
                            <button className="btn btn-epic-cta" onClick={() => goToCP(cp)}>
                              {cp.commentPeriodStatus === 'Open'
                                ? 'Share your thoughts'
                                : 'View Engagement'}
                            </button>
                          </div>
                        </article>
                      ))
                    )}
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
