import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin, concat } from 'rxjs';
import { map, catchError, mergeMap, tap } from 'rxjs/operators';

import { Project } from 'app/models/project';
import { ApiService } from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { Org } from 'app/models/organization';
import { ISearchResults } from 'app/models/search';
import { SearchService } from './search.service';
import { Utils } from 'app/shared/utils/utils';
import { DataQueryResponse } from 'app/models/api-response';
import { LoadingStateService } from './loading-state.service';
import { withLoading } from 'app/shared/utils/rxjs-operators';

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
          if (res) {
            const results = this.utils.extractFromSearchResults(res);
            // let projects: Array<Project> = [];
            this.projectList = [];
            if (results) {
              results.forEach(project => {
                this.projectList.push(new Project(project));
              });
            }
            this.loadingState.stopLoading(loadingId);
            return { totalCount: res[0].data.meta[0].searchResultsTotal, data: this.projectList };
          }
          this.loadingState.stopLoading(loadingId);
          return {};
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
    this.count$ = this.api.getCountProjects()
      .pipe(
        withLoading(this.loadingState, loadingId, 'Counting projects'),
        map(count => {
          this.cachedCount = count;
          return count;
        }),
        catchError(error => this.api.handleError(error))
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
          if (projects) {
            if (projects[0] && projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length === 1) {
              projects[0].commentPeriodForBanner = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
            } else if (projects[0] && projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length > 1) {
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
            } else if (projects[0]) {
              projects[0].commentPeriodForBanner = null;
            }
          }
          // return the first (only) project
          return projects.length > 0 ? new Project(projects[0]) : null;
        }),
        mergeMap(res => {
          const project = res;
          if (!project) {
            this.loadingState.stopLoading(loadingId);
            return of(null as unknown as Project);
          }
          // Map the build to the human readable nature field
          project.nature = this.utils.natureBuildMapper(project.build);
          const partialProject = new Project(project);
          if (project.projectLeadId == null && project.responsibleEPDId == null) {
            this.loadingState.stopLoading(loadingId);
            return of(partialProject);
          }
          // Emit partial project immediately to clear the spinner, then fetch staff data.
          // The component's subscribe handler fires on each emission, so isLoading is
          // cleared on the first emission without waiting for User API calls to complete.
          this.loadingState.stopLoading(loadingId);
          return concat(
            of(partialProject),
            this._getExtraAppData(
              partialProject,
              {
                getresponsibleEPD: project.responsibleEPDId !== null && project.responsibleEPDId !== '' || project.responsibleEPDId !== undefined,
                getprojectLead: project.projectLeadId !== null && project.projectLeadId !== '' || project.projectLeadId !== undefined
              }
            )
          );
        }),
        tap(project => { if (project) this.project = project; }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  getPins(proj: string, pageNum: number, pageSize: number, sortBy: any): Observable<DataQueryResponse<Org>[]> {
    const loadingId = `project-pins-${proj}-page-${pageNum}`;
    return this.api.getProjectPins(proj, pageNum, pageSize, sortBy)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Loading pins'),
        catchError(error => this.api.handleError(error))
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
    return this.api.cacSignUp(project, meta)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Signing up for CAC'),
        catchError(error => this.api.handleError(error))
      );
  }

  // Remove this user from the CAC membership on this project
  cacRemoveMember(projectId: string, meta: any): Observable<any> {
    return this.api.cacRemoveMember(projectId, meta)
      .pipe(
        withLoading(this.loadingState, 'cac-unsubscribe', 'Unsubscribing from CAC'),
        catchError(error => this.api.handleError(error))
      );
  }
}
