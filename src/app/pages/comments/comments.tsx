import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { downloadDocument, searchKeywords } from 'app/api/api';
import * as commentApi from 'app/api/comment';
import * as commentPeriodApi from 'app/api/commentperiod';
import * as documentApi from 'app/api/document';
import * as projectApi from 'app/api/project';
import { logger } from 'app/config/logging';
import { track } from 'app/analytics/analytics';
import type { Comment } from 'app/models/comment';
import type { Document } from 'app/models/document';
import type { Project } from 'app/models/project';
import { showToast } from 'app/state/toast';
import { TableTemplate } from 'app/components/table/table-template';
import { tableObject, type ITableMessage } from 'app/components/table/table-object';
import { mediumDate } from 'app/utils/utils';
import { safeHtml } from 'app/utils/safe-html';
import { CommentsTableRow } from './comments-table-rows';
import './comments.css';

// 500-odd lines of form that only readers who submit a comment ever open.
const AddComment = lazy(() =>
  import('./add-comment').then((module) => ({ default: module.AddComment })),
);

type CommentsType = 'PROJECT' | 'PROJECT-NOTIFICATION';

const COMMENT_PERIOD_HEADERS: Record<string, string> = {
  Closed: 'Public Comment Period is Now Closed',
  Upcoming: 'Public Comment Period is Upcoming',
  Open: 'Public Comment Period is Now Open',
};

/** Project notifications have no project endpoint, so their name comes out of search. */
async function getNotificationProject(projId: string): Promise<Project | null> {
  try {
    const raw = await searchKeywords(
      '',
      'ProjectNotification',
      [],
      1,
      1,
      '',
      '',
      { _id: projId },
      false,
      null,
      {},
      false,
    );
    const hit = (raw as any)?.[0]?.searchResults?.[0];
    return hit ? ({ name: hit.name } as Project) : null;
  } catch {
    // the notification name is non-critical
    return null;
  }
}

async function loadComments(periodId: string, pageNum: number, pageSize: number) {
  const res = await commentApi.getByPeriodId(periodId, pageNum, pageSize, true);
  const comments: Comment[] = res?.currentComments ?? [];

  // Every comment's attachments come back in one request rather than one request per comment.
  const allDocIds: string[] = [];
  comments.forEach((comment) => {
    if (comment.documents && comment.documents.length > 0) {
      // documents arrive as ids or as objects carrying one
      comment.documents = comment.documents.map((doc: any) =>
        typeof doc === 'string' ? doc : doc._id || doc,
      );
      allDocIds.push(...comment.documents);
    }
  });

  if (allDocIds.length > 0) {
    try {
      const docMap = new Map<string, Document>();
      (await documentApi.getByMultiId(allDocIds)).forEach((doc) => {
        if (doc?._id) docMap.set(doc._id, doc);
      });
      comments.forEach((comment) => {
        if (comment.documents) {
          comment.documents = comment.documents.map((id: string) => docMap.get(id)).filter(Boolean);
        }
      });
    } catch (error) {
      logger.error('Error loading documents for comments', 'Comments', error);
      comments.forEach((comment) => {
        if (comment.documents) comment.documents = [];
      });
    }
  }

  return { totalCount: Number(res?.totalCount ?? 0), comments };
}

export function Comments() {
  const { projId, commentPeriodId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isProjectNotificationRoute = pathname.includes('/pn/');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);

  const projectQuery = useQuery({
    queryKey: ['comments-project', projId, isProjectNotificationRoute],
    enabled: !!projId,
    queryFn: async (): Promise<{ project: Project | null; type: CommentsType }> => {
      if (!isProjectNotificationRoute) {
        try {
          const project = await projectApi.getById(projId!);
          if (project) return { project, type: 'PROJECT' };
        } catch (error) {
          logger.error('Error loading project', 'Comments', error);
          return { project: null, type: 'PROJECT' };
        }
        logger.warn(`Project ${projId} not found, trying as ProjectNotification`, 'Comments');
      }
      return { project: await getNotificationProject(projId!), type: 'PROJECT-NOTIFICATION' };
    },
  });

  const periodQuery = useQuery({
    queryKey: ['commentPeriod', commentPeriodId],
    enabled: !!commentPeriodId,
    queryFn: () => commentPeriodApi.getById(commentPeriodId!),
  });

  const commentPeriod = periodQuery.data ?? null;
  const project = projectQuery.data?.project ?? null;
  const type: CommentsType =
    projectQuery.data?.type ?? (isProjectNotificationRoute ? 'PROJECT-NOTIFICATION' : 'PROJECT');

  const docsQuery = useQuery({
    queryKey: ['commentPeriodDocs', commentPeriodId],
    enabled: !!commentPeriod?.relatedDocuments?.length,
    queryFn: () => documentApi.getByMultiId(commentPeriod!.relatedDocuments),
  });

  const commentsQuery = useQuery({
    queryKey: ['comments', commentPeriod?._id, page, pageSize],
    enabled: !!commentPeriod?._id,
    queryFn: () => loadComments(commentPeriod!._id, page, pageSize),
    // Keep the table on screen while the next page loads, matching the Angular page, which only
    // showed the big spinner on the first load.
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!projId || !commentPeriodId) {
      logger.error('Missing route parameters', 'Comments', { projId, commentPeriodId });
      navigate('/projects');
      return;
    }
    if (periodQuery.isError) {
      logger.error('Error loading comment period', 'Comments', periodQuery.error);
      showToast('Failed to load comment period', { duration: 3000, type: 'error' });
      navigate('/projects');
      return;
    }
    if (periodQuery.isSuccess && !periodQuery.data) {
      showToast('Comment period not found', { duration: 3000, type: 'error' });
      navigate('/projects');
    }
  }, [
    projId,
    commentPeriodId,
    periodQuery.isError,
    periodQuery.isSuccess,
    periodQuery.data,
    periodQuery.error,
    navigate,
  ]);

  const tableData = useMemo(
    () =>
      tableObject({
        tableId: 'comments',
        component: CommentsTableRow,
        options: {
          showPageCountDisplay: true,
          showPagination: true,
          showPageSizePicker: true,
          showTopControls: true,
          showHeader: false,
          disableRowHighlight: true,
        },
        currentPage: page,
        pageSize,
        totalListItems: commentsQuery.data?.totalCount ?? 0,
        items: (commentsQuery.data?.comments ?? []).map((comment) => ({ rowData: comment })),
      }),
    [page, pageSize, commentsQuery.data],
  );

  function onMessageOut(msg: ITableMessage) {
    if (msg.label === 'pageNum') {
      setPage(msg.data);
    } else if (msg.label === 'pageSize') {
      setPageSize(Number(msg.data.value));
      setPage(1);
    }
  }

  function onDownloadDocument(doc: Document) {
    downloadDocument(doc)
      .then(() => showToast('Downloading document', { duration: 2000, type: 'info' }))
      .catch(() =>
        showToast('Error opening document! Please try again later', {
          duration: 2000,
          type: 'error',
        }),
      );
  }

  function goBackToProjectDetails() {
    if (type === 'PROJECT' && project) {
      navigate(`/p/${project._id}`);
    } else {
      navigate('/project-notifications');
    }
  }

  function onModalDismiss(reason: string, modalPage: number) {
    setModalOpen(false);
    logger.debug('Modal cancelled', 'Comments', { reason });
    if (project) {
      track('Comment Modal Dismissed', {
        project_id: project._id,
        project_name: project.name,
        comment_period_id: commentPeriod?._id,
        page: modalPage,
        reason,
      });
    }
  }

  const commentPeriodDocs = docsQuery.data ?? [];
  const commentPeriodHeader = commentPeriod
    ? COMMENT_PERIOD_HEADERS[commentPeriod.commentPeriodStatus] || ''
    : '';
  const pageLoading = !commentPeriod || (type === 'PROJECT' && projectQuery.isPending);

  return (
    <>
      <div className="project">
        <main className="project-info">
          <div className="hero-banner-alt">
            <div className="container">
              <div className="hero-banner__content">
                {pageLoading ? (
                  <div className="d-flex justify-content-center align-items-center py-5">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1>{project?.name || '-'}</h1>

                    {commentPeriod._id && (
                      <>
                        <h2>{commentPeriodHeader || '-'}</h2>
                        <h2>
                          {mediumDate(commentPeriod.dateStarted)} -{' '}
                          {commentPeriod.longEndDate.toFormat('MMMM dd @ hh:mm a ZZZZ')}
                        </h2>
                        <hr className="comment-period-divider" />

                        <div className="header-section">
                          <div>
                            <div
                              id="instructions"
                              dangerouslySetInnerHTML={safeHtml(
                                String(commentPeriod.instructions ?? ''),
                              )}
                            ></div>
                            {commentPeriod.additionalText && <p>{commentPeriod.additionalText}</p>}
                            {commentPeriod.informationLabel && (
                              <p>{commentPeriod.informationLabel}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {type === 'PROJECT' && (
                      <>
                        <span className="ea-decision">{project?.eacDecision?.name || '-'}</span>
                        <div className="basic-info">
                          <div>
                            <span className="info-label">Proponent</span>
                            <p className="value">{project?.proponent?.name || '-'}</p>
                          </div>
                          <div>
                            <span className="info-label">Type</span>
                            <p className="value">{project?.type || '-'}</p>
                          </div>
                          <div>
                            <span className="info-label">Sub-type</span>
                            <p className="value">{project?.sector || '-'}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {commentPeriodDocs.length > 0 && (
                      <div className="mb-3">
                        <div className="card-header">Related Documents</div>
                        <ul className="doc-list mb-0">
                          {commentPeriodDocs.map((doc) => (
                            <li
                              key={doc._id}
                              className="clickable-row"
                              role="button"
                              tabIndex={0}
                              onClick={() => onDownloadDocument(doc)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ')
                                  onDownloadDocument(doc);
                              }}
                            >
                              <span className="cell icon">
                                <i className="material-icons">insert_drive_file</i>
                              </span>
                              <span className="cell name" title={doc.displayName || ''}>
                                {doc.displayName}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {commentPeriod.openHouses && commentPeriod.openHouses.length > 0 && (
                      <div className="mb-3">
                        <div className="card border-0">
                          <div className="card-header">Open Houses</div>
                          <ul className="list-group mb-0">
                            {commentPeriod.openHouses.map(
                              (openHouse: { eventDate: string; description: string }) => (
                                <li
                                  className="list-group-item"
                                  key={`${openHouse.eventDate}-${openHouse.description}`}
                                >
                                  <h6 className="mb-2">
                                    <b>Date:</b>&nbsp;{mediumDate(openHouse.eventDate)}
                                  </h6>
                                  <h6 className="mb-0">
                                    <b>Description:</b>&nbsp;{openHouse.description}
                                  </h6>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                    <button
                      className="btn btn-sm inverted"
                      onClick={goBackToProjectDetails}
                      type="button"
                    >
                      {type === 'PROJECT'
                        ? 'Back to Project Details'
                        : 'Back to Project Notifications'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="container comments">
        {commentsQuery.isPending ? (
          <div className="d-flex justify-content-center my-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {commentPeriod?.commentPeriodStatus === 'Open' && (
              <div className="mb-3 d-flex justify-content-end">
                <button
                  className="btn btn-warning"
                  onClick={() => commentPeriod._id && setModalOpen(true)}
                  type="button"
                >
                  Submit Comment
                </button>
              </div>
            )}

            {tableData.totalListItems > 0 && (
              <div>
                <TableTemplate data={tableData} onMessage={onMessageOut} />
              </div>
            )}
            {tableData.totalListItems === 0 && <div>There are no comments.</div>}
          </>
        )}
      </div>

      {modalOpen && commentPeriod && (
        <Suspense
          fallback={<div className="placeholder placeholder-wave w-100" aria-busy="true"></div>}
        >
          <AddComment
            currentPeriod={commentPeriod}
            project={project as Project}
            onDismiss={onModalDismiss}
          />
        </Suspense>
      )}
    </>
  );
}
