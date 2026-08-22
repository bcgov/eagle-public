import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, mergeMap, flatMap, tap } from 'rxjs/operators';

import { Project } from 'app/models/project';
import { ApiService } from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { Org } from 'app/models/organization';
import { ISearchResults } from 'app/models/search';
import { SearchService } from './search.service';
import { Utils } from 'app/shared/utils/utils';
import { DataQueryResponse } from 'app/models/api-response';
import { LoadingStateService } from './loading-state.service';
import { LoggingService } from './logging.service';

interface GetParameters {
  getresponsibleEPD?: boolean;
  getprojectLead?: boolean;
}

@Injectable({providedIn:'root'})
export class ProjectService {
  private api = inject(ApiService);
  private searchService = inject(SearchService);
  private utils = inject(Utils);
  private loadingState = inject(LoadingStateService);
  private logger = inject(LoggingService);

  private project: Project | null = null; // for caching
  private projectList: Project[] = [];
  private cachedCount: number | null = null;
  private count$: Observable<number> | null = null;

  // get just the projects (for fast mapping)
  getAll(pageNum = 0, pageSize = 1000000): Observable<Project[]> {
    const loadingId = `projects-page-${pageNum}`;
    this.loadingState.startLoading(loadingId, 'Loading projects');
    return this.searchService.getSearchResults('', 'Project', [], pageNum, pageSize, '', {}, true, '', {}, '')
      .pipe(
        map((res: ISearchResults<Project>[]) => {
          // WHY: search.service.getSearchResults collapses ANY non-2xx into a single `null`,
          // not an array (search.service.ts:65-69), and demi-api - the incoming search backend -
          // answers non-2xx when a search fails rather than 200-with-an-empty-result-set. So on
          // a failed search `res` is null here, and on a malformed one it can be `[]` or a body
          // carrying no `data.meta`. The old `res[0].data.meta[0].searchResultsTotal` threw a
          // TypeError on all three. That TypeError did not stay local: api.handleError re-throws
          // (api.ts:74-78), so it escaped this catchError and getAllFull's, landing in the error
          // handler at projects.component.ts:130-135, which calls router.navigate(['/']) - a
          // failed search bounced the visitor off /projects onto the home page.
          // Degrade to an empty result set instead; the list then renders "No projects found".
          const results = this.utils.extractFromSearchResults(res);
          if (!results) {
            // Logged only, deliberately no toast: EventService.setError feeds errorEvent, but
            // getError() (event.service.ts:57) has zero subscribers in this repo, so raising an
            // event here would notify nobody. Surfacing it in the UI is a separate change.
            this.logger.error('Project search returned no usable results, showing an empty list', 'ProjectService', { res });
          }
          this.projectList = [];
          (results ?? []).forEach(project => {
            this.projectList.push(new Project(project));
          });
          this.loadingState.stopLoading(loadingId);
          return { totalCount: res?.[0]?.data?.meta?.[0]?.searchResultsTotal ?? 0, data: this.projectList };
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // get count of projects
  getCount(): Observable<number> {
    // Return cached count if available
    if (this.cachedCount !== null) {
      return of(this.cachedCount);
    }
    
    // Return in-flight request if one exists
    if (this.count$) {
      return this.count$;
    }
    
    // Create new request and cache it
    const loadingId = 'projects-count';
    this.loadingState.startLoading(loadingId, 'Counting projects');
    this.count$ = this.api.getCountProjects()
      .pipe(
        map(count => {
          this.cachedCount = count;
          this.loadingState.stopLoading(loadingId);
          return count;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
    
    return this.count$;
  }

  // get all projects and related data
  // TODO: instead of using promises to get all data at once, use observables and DEEP-OBSERVE changes
  // see https://github.com/angular/angular/issues/11704
  getAllFull(pageNum = 0, pageSize = 1000000): Observable<Project[]> {
    const loadingId = `projects-full-page-${pageNum}`;
    this.loadingState.startLoading(loadingId, 'Loading projects');
    // first get the projects
    return this.getAll(pageNum, pageSize)
      .pipe(
        mergeMap((projects: any) => {
          if (projects.length === 0) {
            this.loadingState.stopLoading(loadingId);
            return of([] as Project[]);
          }

          const promises: Promise<any>[] = [];

          return Promise.all(promises).then(() => { 
            this.loadingState.stopLoading(loadingId);
            return projects.data; 
          });
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // get a specific project by its id
  getById(projId: string, forceReload = false, cpStart: string | null = null, cpEnd: string | null = null): Observable<Project> {
    if (this.project && this.project._id === projId && !forceReload) {
      return of(this.project);
    }
    const loadingId = `project-${projId}`;
    this.loadingState.startLoading(loadingId, 'Loading project');
    return this.api.getProject(projId, cpStart, cpEnd)
      .pipe(
        map((projects: Project[]) => {
          // get upcoming comment period if there is one and convert it into a comment period object.
          // If there are multiple comment periods any that is currently running is a higher priority than a past comment period
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
          return projects && projects.length > 0 && projects[0] ? new Project(projects[0]) : null;
        }),
        flatMap(res => {
          const project = res;
          if (!project) {
            this.loadingState.stopLoading(loadingId);
            return of(null as unknown as Project);
          }
          // Map the build to the human readable nature field
          project.nature = this.utils.natureBuildMapper(project.build);
          if (project.projectLeadId == null && project.responsibleEPDId == null) {
            this.loadingState.stopLoading(loadingId);
            return of(new Project(project));
          }
          // now get the rest of the data for this project
          return this._getExtraAppData(
            new Project(project),
            {
              getresponsibleEPD: project.responsibleEPDId !== null && project.responsibleEPDId !== '' || project.responsibleEPDId !== undefined,
              getprojectLead: project.projectLeadId !== null && project.projectLeadId !== '' || project.projectLeadId !== undefined
            }
          ).pipe(
            tap(() => this.loadingState.stopLoading(loadingId))
          );
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  getPins(proj: string, pageNum: number, pageSize: number, sortBy: any): Observable<DataQueryResponse<Org>[]> {
    const loadingId = `project-pins-${proj}-page-${pageNum}`;
    this.loadingState.startLoading(loadingId, 'Loading pins');
    return this.api.getProjectPins(proj, pageNum, pageSize, sortBy)
      .pipe(
        map(res => {
          this.loadingState.stopLoading(loadingId);
          return res;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  private _getExtraAppData(project: Project, { getresponsibleEPD = false, getprojectLead = false }: GetParameters): Observable<Project> {
    // Check if both roles are the same person to avoid duplicate API calls
    const sameUser = getresponsibleEPD && getprojectLead && 
                     project.responsibleEPDId && project.projectLeadId &&
                     project.responsibleEPDId.toString() === project.projectLeadId.toString();
    
    if (sameUser) {
      // Fetch user data once and assign to both roles
      return this.searchService.getItem(project.responsibleEPDId.toString(), 'User')
        .pipe(
          map(payload => {
            project.responsibleEPDObj = payload.data;
            project.projectLeadObj = payload.data;
            return project;
          })
        );
    }
    
    // Different users or only one role needed - use forkJoin
    return forkJoin(
      getresponsibleEPD ? this.searchService.getItem(project.responsibleEPDId.toString(), 'User') : of(null),
      getprojectLead ? this.searchService.getItem(project.projectLeadId.toString(), 'User') : of(null)
    )
      .pipe(
        map(payloads => {
          if (getresponsibleEPD) {
            project.responsibleEPDObj = payloads[0].data;
          }
          if (getprojectLead) {
            project.projectLeadObj = payloads[1].data;
          }
          // finally update the object and return
          return project;
        })
      );
  }
  public getPeopleObjs(data: any): Observable<any> {
    const projectSearchData = this.utils.extractFromSearchResults(data);
    if (!projectSearchData) {
      return of(data)
    }
    const project = projectSearchData[0] as Project;

    if (!project) {
      return of(data);
    }
    const epdId = (project.responsibleEPDId) ? project.responsibleEPDId.toString() : '';
    const leadId = (project.projectLeadId) ? project.projectLeadId.toString() : '';
    if (!epdId && !leadId) {
      return of(data);
    }
    return forkJoin(
      this.searchService.getItem(epdId, 'User'),
      this.searchService.getItem(leadId, 'User')
    )
      .pipe(
        map(payloads => {
          if (payloads) {
            project.responsibleEPDObj = payloads[0].data;
            project.projectLeadObj = payloads[1].data;
            // finally update the object and return
          }
          return data;
        })
      );
  }

  // Send this users' information to our CAC back-end
  cacSignUp(project: Project, meta: any): Observable<any> {
    const loadingId = `cac-signup-${project._id}`;
    this.loadingState.startLoading(loadingId, 'Signing up for CAC');
    return this.api.cacSignUp(project, meta)
      .pipe(
        map(res => {
          this.loadingState.stopLoading(loadingId);
          return res;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // Remove this user from the CAC membership on this project
  cacRemoveMember(projectId: string, meta: any): Observable<any> {
    this.loadingState.startLoading('cac-unsubscribe', 'Unsubscribing from CAC');
    return this.api.cacRemoveMember(projectId, meta)
      .pipe(
        map(result => {
          this.loadingState.stopLoading('cac-unsubscribe');
          return result;
        }),
        catchError(error => {
          this.loadingState.stopLoading('cac-unsubscribe');
          return this.api.handleError(error);
        })
      );
  }
}
