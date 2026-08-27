import { Project } from 'app/models/project';
import * as api from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import type { Org } from 'app/models/organization';
import type { ISearchResults } from 'app/models/search';
import * as search from './search';
import { extractFromSearchResults, natureBuildMapper } from 'app/utils/utils';
import type { DataQueryResponse } from 'app/models/api-response';
import { startLoading, stopLoading } from 'app/state/loading-state';
import { logger } from 'app/config/logging';

let cachedCount: number | null = null;
let countRequest: Promise<number> | null = null;

// get just the projects (for fast mapping)
export async function getAll(pageNum = 0, pageSize = 1000000): Promise<{ totalCount: number; data: Project[] }> {
  const loadingId = `projects-page-${pageNum}`;
  startLoading(loadingId, 'Loading projects');
  try {
    const res = await search.getSearchResults('', 'Project', [], pageNum, pageSize, '', {}, true, '', {}, '') as ISearchResults<Project>[] | null;
    // WHY: search.getSearchResults collapses ANY failed request into a single `null`, not an
    // array, and demi-api - the incoming search backend - answers non-2xx when a search fails
    // rather than 200-with-an-empty-result-set. So on a failed search `res` is null here, and on
    // a malformed one it can be `[]` or a body carrying no `data.meta`. Reading
    // `res[0].data.meta[0].searchResultsTotal` threw a TypeError on all three, which escaped
    // into the projects page error handler and bounced the visitor off /projects onto the home
    // page. Degrade to an empty result set instead; the list then renders "No projects found".
    const results = extractFromSearchResults(res as ISearchResults<Project>[]);
    if (!results) {
      logger.error('Project search returned no usable results, showing an empty list', 'project', { res });
    }
    const projectList = (results ?? []).map(project => new Project(project));
    return { totalCount: (res?.[0]?.data?.meta?.[0]?.searchResultsTotal as number) ?? 0, data: projectList };
  } finally {
    stopLoading(loadingId);
  }
}

// get count of projects
export async function getCount(): Promise<number> {
  if (cachedCount !== null) {
    return cachedCount;
  }
  if (countRequest) {
    return countRequest;
  }

  const loadingId = 'projects-count';
  startLoading(loadingId, 'Counting projects');
  countRequest = api.getCountProjects()
    .then(count => {
      cachedCount = count;
      return count;
    })
    .finally(() => stopLoading(loadingId));

  return countRequest;
}

// get all projects and related data
export async function getAllFull(pageNum = 0, pageSize = 1000000): Promise<Project[]> {
  const loadingId = `projects-full-page-${pageNum}`;
  startLoading(loadingId, 'Loading projects');
  try {
    return (await getAll(pageNum, pageSize)).data;
  } finally {
    stopLoading(loadingId);
  }
}

// get a specific project by its id
export async function getById(projId: string, _forceReload = false, cpStart: string | null = null, cpEnd: string | null = null): Promise<Project> {
  const loadingId = `project-${projId}`;
  startLoading(loadingId, 'Loading project');
  try {
    const projects = await api.getProject(projId, cpStart, cpEnd);
    // get upcoming comment period if there is one and convert it into a comment period object.
    // If there are multiple comment periods any that is currently running is a higher priority
    // than a past comment period
    if (projects && projects.length > 0 && projects[0]) {
      if (projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length === 1) {
        projects[0].commentPeriodForBanner = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
      } else if (projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length > 1) {
        const now = new Date
        const currentDate = now.toISOString();
        // Default to the same comment period we're using currently in case one is not active
        let finalCommentPeriod = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
        for (const commentPeriod in projects[0].commentPeriodForBanner) {
          if (Date.parse(projects[0].commentPeriodForBanner[commentPeriod].dateCompleted) > Date.parse(currentDate)
            && Date.parse(projects[0].commentPeriodForBanner[commentPeriod].dateStarted) < Date.parse(currentDate)) {
            finalCommentPeriod = new CommentPeriod(projects[0].commentPeriodForBanner[commentPeriod]);
          }
        }
        projects[0].commentPeriodForBanner = finalCommentPeriod
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
  } finally {
    stopLoading(loadingId);
  }
}

export async function getPins(proj: string, pageNum: number, pageSize: number, sortBy: any): Promise<DataQueryResponse<Org>[]> {
  const loadingId = `project-pins-${proj}-page-${pageNum}`;
  startLoading(loadingId, 'Loading pins');
  try {
    return await api.getProjectPins(proj, pageNum, pageSize, sortBy) as unknown as DataQueryResponse<Org>[];
  } finally {
    stopLoading(loadingId);
  }
}

// Send this users' information to our CAC back-end
export async function cacSignUp(project: Project, meta: any): Promise<any> {
  const loadingId = `cac-signup-${project._id}`;
  startLoading(loadingId, 'Signing up for CAC');
  try {
    return await api.cacSignUp(project, meta);
  } finally {
    stopLoading(loadingId);
  }
}

// Remove this user from the CAC membership on this project
export async function cacRemoveMember(projectId: string, meta: any): Promise<any> {
  startLoading('cac-unsubscribe', 'Unsubscribing from CAC');
  try {
    return await api.cacRemoveMember(projectId, meta);
  } finally {
    stopLoading('cac-unsubscribe');
  }
}
