import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { searchKeywords } from 'app/api/api';
import * as commentApi from 'app/api/comment';
import * as commentPeriodApi from 'app/api/commentperiod';
import * as documentApi from 'app/api/document';
import * as projectApi from 'app/api/project';
import { logger } from 'app/config/logging';
import { searchUrl } from 'app/routes/legacy-search';
import type { Comment } from 'app/models/comment';
import type { Document } from 'app/models/document';
import type { Project } from 'app/models/project';
import { showToast } from 'app/state/toast';
import { PageMasthead } from 'app/layout/page-masthead';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { DisplayGrid } from 'app/components/display-grid/display-grid';
import { GridPager } from 'app/components/display-grid/grid-footer';
import { GridToolbar } from 'app/components/display-grid/grid-toolbar';
import { mediumDate, openDocumentDownload } from 'app/utils/utils';
import { safeHtml } from 'app/utils/safe-html';
import { StatusPill, type StatusTone } from 'app/components/status-pill';
import { CommentRow } from './comment-row';
import './comments.css';

type CommentsType = 'PROJECT' | 'PROJECT-NOTIFICATION';

const COMMENT_PERIOD_HEADERS: Record<string, string> = {
  Closed: 'Public Comment Period is Now Closed',
  Upcoming: 'Public Comment Period is Upcoming',
  Open: 'Public Comment Period is Now Open',
};

// `eaDecisions` List names. Anything not named (exemption, withdrawn, in progress) reads as info.
const EA_DECISION_TONES: Record<string, StatusTone> = {
  'Certificate Issued': 'success',
  'Certificate Reinstated': 'success',
  'Pre-EA Act Approval': 'success',
  'Certificate Refused': 'danger',
  'Certificate Cancelled': 'danger',
  'Assessment Terminated': 'danger',
  'Readiness Termination': 'danger',
  Terminated: 'danger',
};

function eaDecisionTone(name: string): StatusTone {
  return EA_DECISION_TONES[name] ?? 'info';
}

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
  const res = await commentApi.getByPeriodId(periodId, pageNum, pageSize);
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

  // `openDocumentDownload` starts the transfer and falls back to eagle-api on its own, so there
  // is no failure for the caller to report.
  function onDownloadDocument(doc: Document) {
    openDocumentDownload(doc);
    showToast('Downloading document', { duration: 2000, type: 'info' });
  }

  function goBackToProjectDetails() {
    if (type === 'PROJECT' && project) {
      navigate(`/p/${project._id}`);
    } else {
      navigate(searchUrl('notifications'));
    }
  }

  const commentsTotal = commentsQuery.data?.totalCount ?? 0;
  const commentPeriodDocs = docsQuery.data ?? [];
  const openHouses: { eventDate: string; description: string }[] = commentPeriod?.openHouses ?? [];
  const commentPeriodHeader = commentPeriod
    ? COMMENT_PERIOD_HEADERS[commentPeriod.commentPeriodStatus] || ''
    : '';
  const pageLoading = !commentPeriod || (type === 'PROJECT' && projectQuery.isPending);

  return (
    <>
      <PageMasthead
        busy={pageLoading}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Search', to: searchUrl(type === 'PROJECT' ? 'projects' : 'notifications') },
          // A notification has no page of its own, so its name is plain text.
          { label: project?.name ?? '', to: type === 'PROJECT' ? `/p/${projId}` : undefined },
          { label: 'Comment period' },
        ]}
        title={
          pageLoading ? (
            <>
              <span className="visually-hidden">Loading comment period</span>
              <Skeleton width="60%" />
            </>
          ) : (
            project?.name || '-'
          )
        }
        className="comment-banner"
      >
        {!pageLoading && (
          <div className="comment-banner__body">
            {commentPeriod._id && (
              <>
                <h2 className="comment-banner__status">{commentPeriodHeader || '-'}</h2>
                <h2 className="comment-banner__status">
                  {mediumDate(commentPeriod.dateStarted)} -{' '}
                  {commentPeriod.longEndDate.toFormat('MMMM dd @ hh:mm a ZZZZ')}
                </h2>
                <hr className="comment-banner__divider" />

                <div className="comment-banner__instructions">
                  <div
                    id="instructions"
                    dangerouslySetInnerHTML={safeHtml(String(commentPeriod.instructions ?? ''))}
                  ></div>
                  {commentPeriod.additionalText && <p>{commentPeriod.additionalText}</p>}
                  {commentPeriod.informationLabel && <p>{commentPeriod.informationLabel}</p>}
                </div>
              </>
            )}

            {type === 'PROJECT' && (
              <>
                {project?.eacDecision?.name && (
                  <StatusPill tone={eaDecisionTone(project.eacDecision.name)}>
                    {project.eacDecision.name}
                  </StatusPill>
                )}
                <dl className="comment-banner__facts">
                  {(
                    [
                      ['Proponent', project?.proponent?.name],
                      ['Type', project?.type],
                      ['Sub-type', project?.sector],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || '-'}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {commentPeriodDocs.length > 0 && (
              <section className="comment-banner__card" aria-labelledby="related-docs-title">
                <h2 id="related-docs-title" className="comment-banner__card-title">
                  Related Documents
                </h2>
                <ul className="comment-banner__docs">
                  {commentPeriodDocs.map((doc) => (
                    <li key={doc._id}>
                      {/* A button, not a link: the download URL is fetched on click. */}
                      <button
                        type="button"
                        className="comment-banner__doc"
                        onClick={() => onDownloadDocument(doc)}
                      >
                        <i className="material-icons" aria-hidden="true">
                          insert_drive_file
                        </i>
                        <span title={doc.displayName || ''}>{doc.displayName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {openHouses.length > 0 && (
              <section className="comment-banner__card" aria-labelledby="open-houses-title">
                <h2 id="open-houses-title" className="comment-banner__card-title">
                  Open Houses
                </h2>
                <ul className="comment-banner__open-houses">
                  {openHouses.map((openHouse) => (
                    <li key={`${openHouse.eventDate}-${openHouse.description}`}>
                      <p>
                        <b>Date:</b>&nbsp;{mediumDate(openHouse.eventDate)}
                      </p>
                      <p>
                        <b>Description:</b>&nbsp;{openHouse.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button
              className="btn-on-dark comment-banner__back"
              onClick={goBackToProjectDetails}
              type="button"
            >
              {type === 'PROJECT' ? 'Back to Project Details' : 'Back to Project Notifications'}
            </button>
          </div>
        )}
      </PageMasthead>

      <div className="comment-period__list">
        <div className="page-container page-body">
          <DisplayGrid<Comment>
            caption="Public comments on this period"
            template="list"
            columns={[]}
            rows={commentsQuery.data?.comments ?? []}
            rowComponent={CommentRow}
            rowId={(comment) => comment._id}
            loading={commentsQuery.isFetching}
            emptyMessage="There are no comments."
            page={page}
            pageSize={pageSize}
            total={commentsTotal}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            toolbar={
              <GridToolbar<Comment>
                noun="comments"
                page={page}
                pageSize={pageSize}
                total={commentsTotal}
                loading={commentsQuery.isFetching}
                pager={
                  <GridPager
                    page={page}
                    pageSize={pageSize}
                    total={commentsTotal}
                    ariaLabel="Comment pages, top"
                    onPageChange={setPage}
                  />
                }
              />
            }
          />
        </div>
      </div>
    </>
  );
}
