import { Project } from 'app/models/project';
import * as api from './api';
import type { DemiProject, ListRef } from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { commentPeriodsQueryOptions } from './commentperiod';
import { queryClient } from './query-client';
import type { Org } from 'app/models/organization';
import type { ISearchResults } from 'app/models/search';
import * as search from './search';
import { extractFromSearchResults, idToListRow, natureBuildMapper } from 'app/utils/utils';
import type { DataQueryResponse } from 'app/models/api-response';
import { logger } from 'app/config/logging';

// get just the projects (for fast mapping)
export async function getAll(
  pageNum = 0,
  pageSize = 1000000,
): Promise<{ totalCount: number; data: Project[] }> {
  const res = (await search.getSearchResults(
    '',
    'Project',
    [],
    pageNum,
    pageSize,
    '',
    {},
    true,
    '',
    {},
    '',
  )) as ISearchResults<Project>[] | null;
  // WHY: search.getSearchResults collapses ANY failed request into a single `null`, not an
  // array, and demi-api - the incoming search backend - answers non-2xx when a search fails
  // rather than 200-with-an-empty-result-set. So on a failed search `res` is null here, and on
  // a malformed one it can be `[]` or a body carrying no `data.meta`. Reading
  // `res[0].data.meta[0].searchResultsTotal` threw a TypeError on all three, which escaped
  // into the projects page error handler and bounced the visitor off /projects onto the home
  // page. Degrade to an empty result set instead; the list then renders "No projects found".
  const results = extractFromSearchResults(res as ISearchResults<Project>[]);
  if (!results) {
    logger.error('Project search returned no usable results, showing an empty list', 'project', {
      res,
    });
  }
  const projectList = (results ?? []).map((project) => new Project(project));
  return {
    totalCount: (res?.[0]?.data?.meta?.[0]?.searchResultsTotal as number) ?? 0,
    data: projectList,
  };
}

// get all projects and related data
export async function getAllFull(pageNum = 0, pageSize = 1000000): Promise<Project[]> {
  return (await getAll(pageNum, pageSize)).data;
}

/**
 * The comment periods the banner may draw, from every period of the project.
 *
 * Same window eagle-api's `cpStart`/`cpEnd` lookup applies (controllers/project.js
 * `handleCommentPeriodForBannerQueryParameters`): a period qualifies when it starts inside the
 * window, ends inside it, or spans it. `getPeriodsByProjId` already asks a public backend, so the
 * read-array check that goes with it on eagle-api has happened before the rows get here.
 */
export function periodsInWindow(
  periods: CommentPeriod[],
  since: string | null,
  until: string | null,
): CommentPeriod[] {
  if (since === null || until === null) return [];
  const from = Date.parse(since);
  const to = Date.parse(until);
  if (Number.isNaN(from) || Number.isNaN(to)) return [];

  // Rows arrive either as raw API date strings or as `CommentPeriod` instances holding `Date`s.
  const timeOf = (value: string | Date | undefined): number => new Date(value ?? '').getTime();

  return periods.filter((period) => {
    const started = timeOf(period?.dateStarted);
    const completed = timeOf(period?.dateCompleted);
    // Each clause is independent, as the three Mongo `$or` branches are: a date the record does
    // not hold fails only the clauses that read it.
    const startsInside = started >= from && started <= to;
    const endsInside = completed >= from && completed <= to;
    const spans = started <= from && completed >= to;
    return startsInside || endsInside || spans;
  });
}

/**
 * A DEMI project document as the eagle-api project payload the app has always consumed, so
 * `Project` and every page reading it stay untouched.
 *
 * Most fields are the same name on both sides. The ones that are not: `eagleId` is the Eagle `_id`;
 * `projectType`/`projectState`/`address` are Track's spelling of `type`/`status`/`location`;
 * `centroid` is stored as GeoJSON and the map wants the bare `[lon, lat]` pair; and the proponent is
 * two scalars rather than the populated Organization, so it is rebuilt as the `{_id, name}` the
 * masthead and panel read.
 *
 * `dateUpdated` is Eagle's own, mirrored by DEMI; `updatedAt` stamps the last DEMI sync and is ignored.
 *
 * `featuredDocuments` is not mapped: the featured-documents page runs its own document search.
 *
 * `eacDecision`, `currentPhaseName` and `CEAAInvolvement` are `List` references, which DEMI answers
 * as bare ids where eagle-api populates the row. Both shapes are accepted: a row passes through, an
 * id is looked up in `lists`. An id no row names stays undefined, so the fact renders "-" rather
 * than the id.
 *
 * DEMI has no counterpart for `CELead*`, `projectLeadId`, `responsibleEPDId`, `epicProjectID`,
 * `commodity`, `fedElecDist`, `shortName`, `duration`, `primaryContact`, `proMember`,
 * `isTermsAgreed`, `dateCommentsClosed`, `addedBy`/`updatedBy`, or the `read`/`write`/`delete` ACLs
 * it withholds by policy, so those stay absent and their facts render as "-".
 */
export function demiProjectToEagle(
  doc: DemiProject,
  commentPeriodForBanner: CommentPeriod[] = [],
  lists: ListRef[] = [],
): Partial<Project> {
  const centroid = doc.centroid;
  const resolveListRef = (value: string | ListRef | undefined): ListRef | undefined =>
    typeof value === 'string' ? idToListRow(value, lists) : value;
  return {
    _id: doc.eagleId ?? doc._id,
    name: doc.name,
    description: doc.description,
    type: doc.projectType,
    sector: doc.sector,
    location: doc.address,
    status: doc.projectState,
    region: doc.region,
    provElecDist: doc.provElecDist,
    centroid: Array.isArray(centroid) ? centroid : (centroid?.coordinates ?? []),
    legislation: doc.legislation,
    build: doc.build,
    code: doc.code,
    substitution: doc.substitution,
    overallProgress: doc.overallProgress,
    eaoMember: doc.eaoMember,
    dateAdded: doc.dateAdded,
    dateUpdated: doc.dateUpdated,
    decisionDate: doc.decisionDate,
    eacDecision: resolveListRef(doc.eacDecision),
    eaCertificate: doc.eaCertificate,
    applicableRegulation: doc.applicableRegulation,
    currentPhaseName: resolveListRef(doc.currentPhaseName),
    phaseHistory: doc.phaseHistory,
    CEAAInvolvement: resolveListRef(doc.CEAAInvolvement),
    CEAALink: doc.CEAALink,
    projectLead: doc.projectLead,
    projectLeadEmail: doc.projectLeadEmail,
    projectLeadPhone: doc.projectLeadPhone,
    responsibleEPD: doc.responsibleEPD,
    responsibleEPDEmail: doc.responsibleEPDEmail,
    responsibleEPDPhone: doc.responsibleEPDPhone,
    proponent: { _id: doc.proponentId, name: doc.proponentName },
    projectCAC: doc.projectCAC,
    projectCACPublished: doc.projectCACPublished,
    cacEmail: doc.cacEmail,
    commentPeriodForBanner,
  };
}

/**
 * The single project record, from DEMI when it is configured and from eagle-api otherwise. The
 * result is the one-element array eagle-api's route answers with, so the caller keeps one shape.
 *
 * A DEMI project that answers 404, one whose read fails outright, or a DEMI that is off all fall
 * through to eagle-api rather than showing "Project not found": the two stores are not guaranteed
 * to hold the same set, and DEMI being down is not the project being missing.
 */
async function readProject(
  projId: string,
  cpStart: string | null,
  cpEnd: string | null,
): Promise<(Partial<Project> | Project)[]> {
  if (api.demiProjectsPath()) {
    let doc: DemiProject | null = null;
    try {
      doc = await api.getDemiProject(projId);
    } catch (error) {
      logger.warn('DEMI project read failed, falling back to eagle-api', 'project', error);
    }
    if (doc) {
      // The banner is a project field on eagle-api and a comment-period read here, so it is
      // derived from the periods rather than requested. No window, no banner, so no request; and a
      // banner that cannot be read is a missing banner, never a missing project.
      let periods: CommentPeriod[] = [];
      if (cpStart !== null && cpEnd !== null) {
        try {
          // No retries: the project record is already in hand and must not wait on a banner.
          periods = await queryClient.fetchQuery({
            ...commentPeriodsQueryOptions(projId),
            retry: false,
          });
        } catch (error) {
          logger.warn('Banner comment period read failed, showing no banner', 'project', error);
        }
      }
      // The `List` rows the id-shaped project fields resolve against. Only worth asking for when
      // at least one of the three fields is a bare id string; a DEMI doc that answers all three
      // pre-populated (as eagle-api does) has nothing left to look up. The project shell asks for
      // the same key on mount, so when needed this joins that one in-flight request rather than
      // adding a second. No retries, for the reason the banner has none; rows that never arrive
      // leave the List-backed facts empty, which is what they already show today.
      let lists: ListRef[] = [];
      if (
        typeof doc.eacDecision === 'string' ||
        typeof doc.currentPhaseName === 'string' ||
        typeof doc.CEAAInvolvement === 'string'
      ) {
        try {
          lists = await queryClient.fetchQuery({ ...api.listsQueryOptions(), retry: false });
        } catch (error) {
          logger.warn('List read failed, leaving the List-backed facts empty', 'project', error);
        }
      }
      return [demiProjectToEagle(doc, periodsInWindow(periods, cpStart, cpEnd), lists)];
    }
  }
  return api.getProject(projId, cpStart, cpEnd);
}

// get a specific project by its id
export async function getById(
  projId: string,
  _forceReload = false,
  cpStart: string | null = null,
  cpEnd: string | null = null,
): Promise<Project> {
  const projects = await readProject(projId, cpStart, cpEnd);
  // get upcoming comment period if there is one and convert it into a comment period object.
  // If there are multiple comment periods any that is currently running is a higher priority
  // than a past comment period
  if (projects && projects.length > 0 && projects[0]) {
    if (projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length === 1) {
      projects[0].commentPeriodForBanner = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
    } else if (
      projects[0].commentPeriodForBanner &&
      projects[0].commentPeriodForBanner.length > 1
    ) {
      const now = new Date();
      const currentDate = now.toISOString();
      // Default to the same comment period we're using currently in case one is not active
      let finalCommentPeriod = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
      for (const commentPeriod in projects[0].commentPeriodForBanner) {
        if (
          Date.parse(projects[0].commentPeriodForBanner[commentPeriod].dateCompleted) >
            Date.parse(currentDate) &&
          Date.parse(projects[0].commentPeriodForBanner[commentPeriod].dateStarted) <
            Date.parse(currentDate)
        ) {
          finalCommentPeriod = new CommentPeriod(projects[0].commentPeriodForBanner[commentPeriod]);
        }
      }
      projects[0].commentPeriodForBanner = finalCommentPeriod;
    } else {
      projects[0].commentPeriodForBanner = null;
    }
  }
  // return the first (only) project
  const found = projects && projects.length > 0 && projects[0] ? new Project(projects[0]) : null;
  if (!found) {
    return null as unknown as Project;
  }
  // Map the build to the human readable nature field
  found.nature = natureBuildMapper(found.build);
  return found;
}

export async function getPins(
  proj: string,
  pageNum: number,
  pageSize: number,
  sortBy: any,
): Promise<DataQueryResponse<Org>[]> {
  return (await api.getProjectPins(
    proj,
    pageNum,
    pageSize,
    sortBy,
  )) as unknown as DataQueryResponse<Org>[];
}

// Remove this user from the CAC membership on this project
export async function cacRemoveMember(projectId: string, meta: any): Promise<any> {
  return api.cacRemoveMember(projectId, meta);
}
