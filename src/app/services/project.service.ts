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

@Injectable()
export class ProjectService {
  private project: Project = null; // for caching

  constructor(
    private api: ApiService,
    private commentPeriodService: CommentPeriodService,
  ) { }

  // get just the projects (for fast mapping)
  getAll(pageNum: number = 0, pageSize: number = 1000000, regionFilters: object = {}, cpStatusFilters: object = {}, appStatusFilters: object = {},
    applicantFilter: string = null, clFileFilter: string = null, dispIdFilter: string = null, purposeFilter: string = null): Observable<Project[]> {
    const regions: Array<string> = [];
    const cpStatuses: Array<string> = [];
    const appStatuses: Array<string> = [];

    // convert array-like objects to arrays
    Object.keys(regionFilters).forEach(key => { if (regionFilters[key]) { regions.push(key); } });
    Object.keys(cpStatusFilters).forEach(key => { if (cpStatusFilters[key]) { cpStatuses.push(key); } });
    Object.keys(appStatusFilters).forEach(key => { if (appStatusFilters[key]) { appStatuses.push(key); } });

    return this.api.getProjects(pageNum, pageSize, regions, cpStatuses, appStatuses, applicantFilter, clFileFilter, dispIdFilter, purposeFilter)
      .map(res => {
        const projects = res.text() ? res.json() : [];
        projects.forEach((project, i) => {
          projects[i] = new Project(project);
          // FUTURE: derive region code, etc ?
        });
        return projects;
      })
      .catch(this.api.handleError);
  }

  // get count of projects
  getCount(): Observable<number> {
    return this.api.getCountProjects()
      .map(res => {
        // retrieve the count from the response headers
        return parseInt(res.headers.get('x-total-count'), 10);
      })
      .catch(this.api.handleError);
  }

  // get all projects and related data
  // TODO: instead of using promises to get all data at once, use observables and DEEP-OBSERVE changes
  // see https://github.com/angular/angular/issues/11704
  getAllFull(pageNum: number = 0, pageSize: number = 1000000, regionFilters: object = {}, cpStatusFilters: object = {}, appStatusFilters: object = {},
    applicantFilter: string = null, clFileFilter: string = null, dispIdFilter: string = null, purposeFilter: string = null): Observable<Project[]> {
    // first get the projects
    return this.getAll(pageNum, pageSize, regionFilters, cpStatusFilters, appStatusFilters, applicantFilter, clFileFilter, dispIdFilter, purposeFilter)
      .mergeMap(projects => {
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
    // first get the project
    return this.api.getProject(projId, cpStart, cpEnd)
      .map(res => {
        const projects = res.text() ? res.json() : [];
        if (projects[0].commentPeriodForBanner && projects[0].commentPeriodForBanner.length > 0) {
          projects[0].commentPeriodForBanner = new CommentPeriod(projects[0].commentPeriodForBanner[0]);
        } else {
          projects[0].commentPeriodForBanner = null;
        }
        // return the first (only) project
        return projects.length > 0 ? new Project(projects[0]) : null;
      })
      .catch(this.api.handleError);
  }
}
