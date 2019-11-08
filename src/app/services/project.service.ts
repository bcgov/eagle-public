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
import { CommentPeriodService } from './commentperiod.service';
import { CommentPeriod } from 'app/models/commentperiod';
import { Org } from 'app/models/organization';
import { SearchResults, ISearchResults } from 'app/models/search';
import { flatMap } from 'rxjs/operators';
import { of } from 'rxjs/internal/observable/of';
import { forkJoin } from 'rxjs';
import { SearchService } from './search.service';
import { Utils } from 'app/shared/utils/utils';

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
    private commentPeriodService: CommentPeriodService,
    private searchService: SearchService,
    private utils: Utils
  ) { }

  // get just the projects (for fast mapping)
  getAll(pageNum: number = 0, pageSize: number = 1000000, regionFilters: object = {}, cpStatusFilters: object = {}, appStatusFilters: object = {},
    applicantFilter: string = null, clFileFilter: string = null, dispIdFilter: string = null, purposeFilter: string = null): Observable<Project[]> {
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
  getAllFull(pageNum: number = 0, pageSize: number = 1000000, regionFilters: object = {}, cpStatusFilters: object = {}, appStatusFilters: object = {},
    applicantFilter: string = null, clFileFilter: string = null, dispIdFilter: string = null, purposeFilter: string = null): Observable<Project[]> {
    // first get the projects
    return this.getAll(pageNum, pageSize, regionFilters, cpStatusFilters, appStatusFilters, applicantFilter, clFileFilter, dispIdFilter, purposeFilter)
      .mergeMap((projects: any) => {
        if (projects.length === 0) {
          return Observable.of([] as Project[]);
        }

        const promises: Array<Promise<any>> = [];

        projects.forEach((project) => {
          // Set relevant things here
        });

        return Promise.all(promises).then(() => { return projects; });
      })
      .catch(this.api.handleError);
  }

  // get a specific project by its id
  getById(projId: string, forceReload: boolean = false, cpStart: string = null, cpEnd: string = null): Observable<Project> {
    if (this.project && this.project._id === projId && !forceReload) {
      return Observable.of(this.project);
    }
    return this.searchService.getSearchResults('', 'Project', null, null, 1, '', {_id: projId}, true, '',  {},  '')
      .map((projects: ISearchResults<Project>[]) => {
        let results;
        // get upcoming comment period if there is one and convert it into a comment period object.
        if (projects.length > 0) {
          results = this.utils.extractFromSearchResults(projects);
          if (results[0].commentPeriodForBanner && results[0].commentPeriodForBanner.length > 0) {
            results[0].commentPeriodForBanner = new CommentPeriod(results[0].commentPeriodForBanner[0]);
          } else {
            results[0].commentPeriodForBanner = null;
          }
        }
        // return the first (only) project
        return results.length > 0 ? new Project(results[0]) : null;
      })
      .pipe(
        flatMap(res => {
          let project = res;
          if (!project) {
            return of(null as Project);
          }
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

  getPins(proj: string, pageNum: number, pageSize: number, sortBy: any): Observable<Org> {
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
}
