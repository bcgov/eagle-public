import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/of';
import * as _ from 'lodash';

import { Project } from 'app/models/project';
import { ApiService } from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { Org } from 'app/models/organization';
import { ISearchResults } from 'app/models/search';
import { flatMap } from 'rxjs/operators';
import { of } from 'rxjs/internal/observable/of';
import { forkJoin } from 'rxjs';
import { SearchService } from './search.service';
import { Utils } from 'app/shared/utils/utils';
import { DataQueryResponse } from 'app/models/api-response';

interface GetParameters {
  getresponsibleEPD?: boolean;
  getprojectLead?: boolean;
}

@Injectable()
export class ProjectService {
  private project: Project = null; // for caching
  private projectList: Project[] = [];


  constructor(
    private api: ApiService,
    private searchService: SearchService,
    private utils: Utils
  ) { }

  // get just the projects (for fast mapping)
  getAll(pageNum: number = 0, pageSize: number = 1000000): Observable<Project[]> {
      return this.searchService.getSearchResults('', 'Project', null, pageNum, pageSize, '', {}, true, '',  {}, '')
      .map((res: ISearchResults<Project>[]) => {
        if (res) {
          const results = this.utils.extractFromSearchResults(res);
          // let projects: Array<Project> = [];
          this.projectList = [];
          results.forEach(project => {
            this.projectList.push(new Project(project));
          });
          return { totalCount: res[0].data.meta[0].searchResultsTotal, data: this.projectList };
        }
        return {};
      })
      .catch(error => this.api.handleError(error));
  }

  // get count of projects
  getCount(): Observable<number> {
    return this.api.getCountProjects()
      .catch(error => this.api.handleError(error));
  }

  // get all projects and related data
  // TODO: instead of using promises to get all data at once, use observables and DEEP-OBSERVE changes
  // see https://github.com/angular/angular/issues/11704
  getAllFull(pageNum: number = 0, pageSize: number = 1000000): Observable<Project[]> {
    // first get the projects
    return this.getAll(pageNum, pageSize)
      .mergeMap((projects: any) => {
        if (projects.length === 0) {
          return Observable.of([] as Project[]);
        }

        const promises: Array<Promise<any>> = [];

        return Promise.all(promises).then(() => { return projects.data; });
      })
      .catch(this.api.handleError);
  }

  // get a specific project by its id
  getById(projId: string, forceReload: boolean = false, cpStart: string = null, cpEnd: string = null): Observable<Project> {
    if (this.project && this.project._id === projId && !forceReload) {
      return Observable.of(this.project);
    }
    return this.api.getProject(projId, cpStart, cpEnd)
      .map((projects: Project[]) => {
        // get upcoming comment period if there is one and convert it into a comment period object.
        // If there are multiple comment periods any that is currently running is a higher priority than a past comment period
        if (projects) {
          if (projects[0] && projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length === 1) {
            projects[0].commentPeriodForBanner = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
          } else if (projects[0] && projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length > 1) {
              let now = new Date
              let currentDate = now.toISOString();
              // Default to the same comment period we're using currently in case one is not active
              let finalCommentPeriod = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
              for (let commentPeriod in projects[0].commentPeriodForBanner) {
                if (Date.parse(projects[0].commentPeriodForBanner[commentPeriod].dateCompleted) > Date.parse(currentDate)
                && Date.parse(projects[0].commentPeriodForBanner[commentPeriod].dateStarted)  < Date.parse(currentDate) ) {
                    finalCommentPeriod = new CommentPeriod(projects[0].commentPeriodForBanner[commentPeriod]);
                }
              }
              projects[0].commentPeriodForBanner = finalCommentPeriod
          } else {
            projects[0].commentPeriodForBanner = null;
          }
        }
        // return the first (only) project
        return projects.length > 0 ? new Project(projects[0]) : null;
      })
      .pipe(
        flatMap(res => {
          let project = res;
          if (!project) {
            return of(null as Project);
          }
          // Map the build to the human readable nature field
          project.nature = this.utils.natureBuildMapper(project.build);
          if (project.projectLeadId == null && project.responsibleEPDId == null) {
            return of(new Project(project));
          }
          // now get the rest of the data for this project
          return this._getExtraAppData(
            new Project(project),
            {
              getresponsibleEPD: project.responsibleEPDId !== null && project.responsibleEPDId !== '' || project.responsibleEPDId !== undefined,
              getprojectLead: project.projectLeadId !== null && project.projectLeadId !== '' || project.projectLeadId !== undefined
            }
          );
        })
      )
      .catch(error => this.api.handleError(error));
  }

  getPins(proj: string, pageNum: number, pageSize: number, sortBy: any): Observable<DataQueryResponse<Org>[]> {
    return this.api.getProjectPins(proj, pageNum, pageSize, sortBy)
      .catch(error => this.api.handleError(error));
  }

  private _getExtraAppData(project: Project, { getresponsibleEPD = false, getprojectLead = false }: GetParameters): Observable<Project> {
    return forkJoin(
      getresponsibleEPD ? this.searchService.getItem(project.responsibleEPDId.toString(), 'User') : of(null),
      getprojectLead ? this.searchService.getItem(project.projectLeadId.toString(), 'User') : of(null)
    )
      .map(payloads => {
        if (getresponsibleEPD) {
          project.responsibleEPDObj = payloads[0].data;
        }
        if (getprojectLead) {
          project.projectLeadObj = payloads[1].data;
        }
        // finally update the object and return
        return project;
      });
  }
  public getPeopleObjs(data): Observable<any> {
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
      .map(payloads => {
        if (payloads) {
          project.responsibleEPDObj = payloads[0].data;
          project.projectLeadObj = payloads[1].data;
          // finally update the object and return
        }
        return data;
      });
  }

  // Send this users' information to our CAC back-end
  cacSignUp(project: Project, meta: any): Observable<any> {
    return this.api.cacSignUp(project, meta)
      .catch(error => this.api.handleError(error));
  }

  // Remove this user from the CAC membership on this project
  cacRemoveMember(projectId: String, meta: any): Observable<any> {
    return this.api.cacRemoveMember(projectId, meta)
      .catch(error => this.api.handleError(error));
  }
}
