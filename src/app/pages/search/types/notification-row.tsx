import { useId, useState, type KeyboardEvent } from 'react';
import { CommentPeriodCards } from 'app/components/comment-period-card';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import { CommentPeriod } from 'app/models/commentperiod';
import { ProjectNotificationDocumentsTable } from 'app/pages/project-notifications/project-notification-documents-table';
import { ProjectNotificationDocumentsTableDetails } from 'app/pages/project-notifications/project-notification-documents-table-details';
import { useResponsive } from 'app/state/responsive';
// The row copy and these styles come from the `/project-notifications` table row, which this
// replaces; the details table and its stylesheet stay where the detail view still uses them.
import 'app/pages/project-notifications/project-notifications-table-rows.css';

type Row = Record<string, unknown>;
type Tab = 'details' | 'documents' | 'commenting';

/**
 * Arrow, Home and End inside a tab list, per the ARIA tabs pattern with manual activation: they
 * only move focus. Enter and Space select through the button's own click.
 */
function moveFocus(event: KeyboardEvent<HTMLButtonElement>): void {
  const list = event.currentTarget.closest('[role="tablist"]');
  if (!list) return;

  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const here = tabs.indexOf(event.currentTarget);
  let next: number;
  if (event.key === 'ArrowRight') next = (here + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') next = (here - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;

  event.preventDefault();
  tabs[next]?.focus();
}

function text(row: Row, key: string): string {
  return String(row[key] ?? '');
}

function cpStatus(pcp: string): string {
  if (!pcp || pcp === 'none') return '';
  if (pcp === 'pending') return 'Upcoming';
  return pcp.charAt(0).toUpperCase() + pcp.slice(1);
}

/** Stands in for a notification whose comment period only exists as fields on the row itself. */
function fallbackPeriod(row: Row): CommentPeriod {
  const period = new CommentPeriod({
    _id: text(row, '_id'),
    project: text(row, '_id'),
    isMet: row['isMet'],
    metURL: row['metURL'],
    dateStarted: row['dateStarted'],
    dateCompleted: row['dateCompleted'],
    instructions: 'Public Comment Period',
    additionalText: '',
  });

  period.commentPeriodStatus = cpStatus(text(row, 'pcp'));
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

/** One project notification as a full-width row: its details, its documents and its engagement. */
export function NotificationRow({ row }: { row: Row }) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [documentsTabLoaded, setDocumentsTabLoaded] = useState(false);
  const { isMobile } = useResponsive();
  // Several notification cards share a page, so the tab and panel ids have to be per instance.
  const baseId = useId();
  const tabId = (tab: Tab) => `${baseId}-tab-${tab}`;
  const panelId = (tab: Tab) => `${baseId}-panel-${tab}`;

  const id = text(row, '_id');
  const pcp = text(row, 'pcp');
  const hasPcp = pcp !== '' && pcp !== 'none';
  // A record carrying no comment-period id needs a lookup to know whether it has any comment
  // periods: eagle-api leaves the field off, demi-search spells the same thing 'none'. One query
  // serves both that check and the tab body, so opening the tab costs no second request.
  const needsLookup = id !== '' && (!hasPcp || activeTab === 'commenting');

  const { data, isPending } = useCommentPeriods(id, needsLookup);

  const commentPeriods = data?.length === 0 && hasPcp ? [fallbackPeriod(row)] : data;
  const showCommentingTab = hasPcp || (commentPeriods?.length ?? 0) > 0;
  // A notification that belongs to a project shows its periods on the project; the rest keep
  // theirs under the notification itself.
  const associatedProjectId = text(row, 'associatedProjectId');
  const basePath = associatedProjectId
    ? `/p/${associatedProjectId}`
    : id !== ''
      ? `/pn/${id}`
      : null;

  function selectTab(tab: Tab): void {
    setActiveTab(tab);
    if (tab === 'documents') {
      setDocumentsTabLoaded(true);
    }
  }

  function tabProps(tab: Tab) {
    return {
      className: `nav-link${activeTab === tab ? ' active' : ''}`,
      onClick: () => selectTab(tab),
      onKeyDown: moveFocus,
      type: 'button' as const,
      role: 'tab',
      id: tabId(tab),
      'aria-controls': panelId(tab),
      'aria-selected': activeTab === tab,
      // One tab stop for the whole list: Tab reaches the selected tab, arrows move between them.
      tabIndex: activeTab === tab ? 0 : -1,
    };
  }

  function panelProps(tab: Tab) {
    return {
      className: `tab-pane fade${activeTab === tab ? ' show active' : ''}`,
      role: 'tabpanel',
      id: panelId(tab),
      'aria-labelledby': tabId(tab),
    };
  }

  return (
    <div className="display-grid__row pn-location-info">
      <div className="pn-content-wrapper">
        <div className="tabs-container">
          <ul className="nav nav-tabs" role="tablist">
            <li className="nav-item" role="presentation">
              <button {...tabProps('details')}>
                {isMobile ? 'Details' : 'Project Notification Details'}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button {...tabProps('documents')}>Documents</button>
            </li>
            {showCommentingTab && (
              <li className="nav-item" role="presentation">
                <button {...tabProps('commenting')}>Engagement</button>
              </li>
            )}
          </ul>

          <div className="tab-content">
            <div {...panelProps('details')}>
              <div className="tab-section">
                <ProjectNotificationDocumentsTableDetails rowData={row} />
              </div>
            </div>

            <div {...panelProps('documents')}>
              {documentsTabLoaded && (
                <div className="tab-section">
                  <ProjectNotificationDocumentsTable
                    header={text(row, 'name').toUpperCase() || '-'}
                    tableId={id}
                    backgroundColor="transparent"
                    rowBackgroundColor="#F7F8FA"
                  />
                </div>
              )}
            </div>

            {showCommentingTab && (
              <div {...panelProps('commenting')}>
                <div className="tab-section pn-info-block py-2">
                  <CommentPeriodCards
                    periods={commentPeriods}
                    loading={needsLookup && isPending}
                    emptyMessage="No comment periods are currently scheduled for this project notification."
                    basePath={basePath}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
