import { Injectable } from '@angular/core';
import { Http, ResponseContentType } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { ErrorObservable } from 'rxjs/observable/ErrorObservable';
import 'rxjs/add/observable/throw';
import * as _ from 'lodash';

import { Comment } from 'app/models/comment';
import { Document } from 'app/models/document';
import { SearchResults } from 'app/models/search';

@Injectable()
export class ApiService {
  // public token: string;
  public isMS: boolean; // IE, Edge, etc
  public apiPath: string;
  public adminUrl: string;
  public env: 'local' | 'dev' | 'test' | 'prod';

  constructor(
    private http: Http
  ) {
    // const currentUser = JSON.parse(window.localStorage.getItem('currentUser'));
    // this.token = currentUser && currentUser.token;
    this.isMS = window.navigator.msSaveOrOpenBlob ? true : false;
    const { hostname } = window.location;
    switch (hostname) {
      case 'localhost':
        // Local
        this.apiPath = 'http://localhost:3000/api/public';
        this.adminUrl = 'http://localhost:4200';
        this.env = 'local';
        break;

      case 'eagle-dev.pathfinder.gov.bc.ca':
        // Dev
        this.apiPath = 'https://eagle-dev.pathfinder.gov.bc.ca/api/public';
        this.adminUrl = 'https://eagle-dev.pathfinder.gov.bc.ca/admin/';
        this.env = 'dev';
        break;

      case 'eagle-test.pathfinder.gov.bc.ca':
        // Test
        this.apiPath = 'https://eagle-test.pathfinder.gov.bc.ca/api/public';
        this.adminUrl = 'https://eagle-test.pathfinder.gov.bc.ca/admin/';
        this.env = 'test';
        break;

      default:
        // Prod
        this.apiPath = 'https://eagle-prod.pathfinder.gov.bc.ca/api/public';
        this.adminUrl = 'https://eagle-prod.pathfinder.gov.bc.ca/admin/';
        this.env = 'prod';
    };
  }

  handleError(error: any): ErrorObservable<never> {
    const reason = error.message ? error.message : (error.status ? `${error.status} - ${error.statusText}` : 'Server error');
    console.log('API error =', reason);
    return Observable.throw(error);
  }

  getFullDataSet(dataSet: string) {
    return this.get(`search?pageSize=1000&dataset=${dataSet}`, {})
      .map((res: any) => {
        let records = JSON.parse(<string>res._body);
        // console.log("records:", records[0].searchResults);
        return records[0].searchResults;
      });
  }

  public async downloadDocument(document: Document): Promise<void> {
    const blob = await this.downloadResource(document._id);
    let filename = document.displayName;

    if (this.isMS) {
      window.navigator.msSaveBlob(blob._body, filename);
    } else {
      const url = window.URL.createObjectURL(blob._body);
      const a = window.document.createElement('a');
      window.document.body.appendChild(a);
      a.setAttribute('style', 'display: none');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    }
  }

  public async openDocument(document: Document): Promise<void> {
    const blob = await this.downloadResource(document._id);
    const filename = document.displayName;

    if (this.isMS) {
      window.navigator.msSaveBlob(blob._body, filename);
    } else {
      const tab = window.open();
      const fileURL = URL.createObjectURL(blob._body);
      tab.location.href = fileURL;
    }
  }

  private downloadResource(id: string) {
    const queryString = `document/${id}/download`;
    return this.get(queryString, { responseType: ResponseContentType.Blob })
      .map((res: any) => res)
      .toPromise();
  }

  getItem(_id: string, schema: string) {
    let queryString = `search?dataset=Item&_id=${_id}&_schemaName=${schema}`;
    return this.get(`${queryString}`, {});
  }

  //
  // Searching
  //
  searchKeywords(keys: string, dataset: string, fields: any[], pageNum: number, pageSize: number, sortBy: string = null, queryModifier = null, populate = false, secondarySort: string = null) {
    let queryString = `search?dataset=${dataset}`;
    if (fields && fields.length > 0) {
      fields.map(item => {
        queryString += `&${item.name}=${item.value}`;
      });
    }
    if (keys) {
      queryString += `&keywords=${keys}`;
    }
    if (pageNum !== null) { queryString += `&pageNum=${pageNum - 1}`; }
    if (pageSize !== null) { queryString += `&pageSize=${pageSize}`; }
    if (sortBy !== null) { queryString += `&sortBy=${sortBy}`; }
    if (secondarySort !== null) { queryString += `&sortBy=${secondarySort}`; }
    if (populate !== null) { queryString += `&populate=${populate}`; }
    if (queryModifier !== null) {
      queryString += `&query` + queryModifier;
    }
    queryString += `&fields=${this.buildValues(fields)}`;
    console.log('here is the query', queryString);
    return this.get(`${queryString}`, {});
  }

  //
  // Projects
  //
  getCountProjects() {
    const queryString = `project`;
    return this.http.head(`${this.apiPath}/${queryString}`);
  }

  getProjects(pageNum: number, pageSize: number, regions: string[], cpStatuses: string[], appStatuses: string[], applicant: string,
    clFile: string, dispId: string, purpose: string) {
    const fields = [
      'agency',
      'areaHectares',
      'businessUnit',
      'centroid',
      'cl_file',
      'client',
      'currentPhaseName',
      'eacDecision',
      'epicProjectID',
      'description',
      'legalDescription',
      'location',
      'name',
      'publishDate',
      'purpose',
      'status',
      'subpurpose',
      'tantalisID',
      'tenureStage',
      'type'
    ];

    let queryString = 'project?';
    if (pageNum !== null) { queryString += `pageNum=${pageNum}&`; }
    if (pageSize !== null) { queryString += `pageSize=${pageSize}&`; }
    if (regions !== null && regions.length > 0) { queryString += `regions=${this.buildValues(regions)}&`; }
    if (cpStatuses !== null && cpStatuses.length > 0) { queryString += `cpStatuses=${this.buildValues(cpStatuses)}&`; }
    if (appStatuses !== null && appStatuses.length > 0) { queryString += `statuses=${this.buildValues(appStatuses)}&`; }
    if (applicant !== null) { queryString += `client=${applicant}&`; }
    if (clFile !== null) { queryString += `cl_file=${clFile}&`; }
    if (dispId !== null) { queryString += `tantalisId=${dispId}&`; }
    if (purpose !== null) { queryString += `purpose=${purpose}&`; }
    queryString += `fields=${this.buildValues(fields)}`;

    return this.get(queryString);
  }

  getProject(id: string, cpStart: Date, cpEnd: Date) {
    const fields = [
      'CEAAInvolvement',
      'CELead',
      'CELeadEmail',
      'CELeadPhone',
      'centroid',
      'description',
      'eacDecision',
      'location',
      'name',
      'projectLead',
      'projectLeadEmail',
      'projectLeadPhone',
      'proponent',
      'region',
      'responsibleEPD',
      'responsibleEPDEmail',
      'responsibleEPDPhone',
      'type',
      'addedBy',
      'build',
      'CEAALink',
      'code',
      'commodity',
      'currentPhaseName',
      'dateAdded',
      'dateCommentsClosed',
      'commentPeriodStatus',
      'dateUpdated',
      'decisionDate',
      'duration',
      'eaoMember',
      'epicProjectID',
      'fedElecDist',
      'isTermsAgreed',
      'overallProgress',
      'primaryContact',
      'proMember',
      'provElecDist',
      'sector',
      'shortName',
      'status',
      'substitution',
      'updatedBy',
      'read',
      'write',
      'delete'
    ];
    let queryString = `project/${id}?populate=true`;
    if (cpStart !== null) { queryString += `&cpStart[until]=${cpStart.getFullYear()}-${cpStart.getMonth()}-${cpStart.getDate()}`; }
    if (cpEnd !== null) { queryString += `&cpEnd[since]=${cpEnd.getFullYear()}-${cpEnd.getMonth()}-${cpEnd.getDate()}`; }
    queryString += `&fields=${this.buildValues(fields)}`;
    return this.get(queryString);
  }

  //
  // Applications
  //
  getCountApplications() {
    const queryString = `application`;
    return this.http.head(`${this.apiPath}/${queryString}`);
  }

  getApplications(pageNum: number, pageSize: number, regions: string[], cpStatuses: string[], appStatuses: string[], applicant: string,
    clFile: string, dispId: string, purpose: string) {
    const fields = [
      'agency',
      'areaHectares',
      'businessUnit',
      'centroid',
      'cl_file',
      'client',
      'description',
      'legalDescription',
      'location',
      'name',
      'publishDate',
      'purpose',
      'status',
      'subpurpose',
      'subtype',
      'tantalisID',
      'tenureStage',
      'type'
    ];

    let queryString = 'application?';
    if (pageNum !== null) { queryString += `pageNum=${pageNum}&`; }
    if (pageSize !== null) { queryString += `pageSize=${pageSize}&`; }
    if (regions !== null && regions.length > 0) { queryString += `regions=${this.buildValues(regions)}&`; }
    if (cpStatuses !== null && cpStatuses.length > 0) { queryString += `cpStatuses=${this.buildValues(cpStatuses)}&`; }
    if (appStatuses !== null && appStatuses.length > 0) { queryString += `statuses=${this.buildValues(appStatuses)}&`; }
    if (applicant !== null) { queryString += `client=${applicant}&`; }
    if (clFile !== null) { queryString += `cl_file=${clFile}&`; }
    if (dispId !== null) { queryString += `tantalisId=${dispId}&`; }
    if (purpose !== null) { queryString += `purpose=${purpose}&`; }
    queryString += `fields=${this.buildValues(fields)}`;

    return this.get(queryString);
  }

  getApplication(id: string) {
    const fields = [
      'agency',
      'areaHectares',
      'businessUnit',
      'centroid',
      'cl_file',
      'client',
      'description',
      'legalDescription',
      'location',
      'name',
      'publishDate',
      'purpose',
      'status',
      'subpurpose',
      'subtype',
      'tantalisID',
      'tenureStage',
      'type'
    ];
    const queryString = 'application/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  //
  // Features
  //
  getFeaturesByTantalisId(tantalisID: number) {
    const fields = [
      'applicationID',
      'geometry',
      'geometryName',
      'properties',
      'type'
    ];
    const queryString = `feature?tantalisId=${tantalisID}&fields=${this.buildValues(fields)}`;
    return this.get(queryString);
  }

  getFeaturesByApplicationId(applicationId: string) {
    const fields = [
      'applicationID',
      'geometry',
      'geometryName',
      'properties',
      'type'
    ];
    const queryString = `feature?applicationId=${applicationId}&fields=${this.buildValues(fields)}`;
    return this.get(queryString);
  }

  //
  // Decisions
  //
  getDecisionByAppId(appId: string) {
    const fields = [
      '_addedBy',
      '_application',
      'name',
      'description'
    ];
    const queryString = 'decision?_application=' + appId + '&fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  getDecision(id: string) {
    const fields = [
      '_addedBy',
      '_application',
      'name',
      'description'
    ];
    const queryString = 'decision/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  //
  // Comment Periods
  //
  getPeriodsByProjId(projId: string) {
    const fields = [
      'project',
      'dateStarted',
      'dateCompleted'
    ];
    // TODO: May want to pass this as a parameter in the future.
    const sort = '&sortBy=-dateStarted';

    let queryString = 'commentperiod?project=' + projId + '&fields=' + this.buildValues(fields) + '&';
    if (sort !== null) { queryString += `sortBy=${sort}&`; }
    return this.get(queryString);
  }

  getPeriod(id: string) {
    const fields = [
      'project',
      'dateStarted',
      'dateCompleted',
      'informationLabel'
    ];
    const queryString = 'commentperiod/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  //
  // Comments
  //
  getCountCommentsById(commentPeriodId) {
    const queryString = `comment?period=${commentPeriodId}`;
    return this.http.head(`${this.apiPath}/${queryString}`);
  }

  getCommentsByPeriodId(pageNum: number, pageSize: number, getCount: boolean, periodId: string) {
    const fields = [
      'author',
      'comment',
      'commentId',
      'dateAdded',
      'dateUpdated',
      'isAnonymous',
      'location',
      'period',
      'read',
      'write',
      'delete'
    ];
    // TODO: May want to pass this as a parameter in the future.
    const sort = '-dateAdded';

    let queryString = 'comment?period=' + periodId + '&fields=' + this.buildValues(fields) + '&';
    if (sort !== null) { queryString += `sortBy=${sort}&`; }
    if (pageNum !== null) { queryString += `pageNum=${pageNum}&`; }
    if (pageSize !== null) { queryString += `pageSize=${pageSize}&`; }
    if (getCount !== null) { queryString += `count=${getCount}&`; }
    return this.get(queryString);
  }

  getComment(id: string) {
    const fields = [
      'author',
      'comment',
      'commentId',
      'dateAdded',
      'dateUpdated',
      'isAnonymous',
      'location',
      'period',
      'read',
      'write',
      'delete'
    ];
    const queryString = 'comment/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  addComment(comment: Comment) {
    const fields = [
      'comment',
      'author'
    ];
    const queryString = 'comment?fields=' + this.buildValues(fields);
    return this.post(queryString, comment);
  }

  //
  // Documents
  //
  getDocumentsByAppId(appId: string) {
    const fields = [
      '_application',
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime'
    ];
    const queryString = 'document?_application=' + appId + '&fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  getDocumentsByCommentId(commentId: string) {
    const fields = [
      '_comment',
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime'
    ];
    const queryString = 'document?_comment=' + commentId + '&fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  getDocumentsByDecisionId(decisionId: string) {
    const fields = [
      '_decision',
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime'
    ];
    const queryString = 'document?_decision=' + decisionId + '&fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  getDocument(id: string) {
    const queryString = 'document/' + id;
    return this.get(queryString);
  }

  uploadDocument(formData: FormData) {
    const fields = [
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime'
    ];
    const queryString = 'document/?fields=' + this.buildValues(fields);
    return this.post(queryString, formData, { reportProgress: true });
  }

  getDocumentUrl(document: Document): string {
    return document ? (this.apiPath + '/document/' + document._id + '/download') : '';
  }

  //
  // Crown Lands files
  //
  getBCGWCrownLands(id: string) {
    const fields = [
      'name',
      'isImported'
    ];
    const queryString = 'search/bcgw/crownLandsId/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  getBCGWDispositionTransactionId(id: number) {
    const fields = [
      'name'
    ];
    const queryString = 'search/bcgw/dispositionTransactionId/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  getClientsInfoByDispositionId(id: number) {
    const fields = [
      'name'
    ];
    const queryString = 'search/bcgw/getClientsInfoByDispositionId/' + id + '?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  //
  // Users
  //
  getAllUsers() {
    const fields = [
      'displayName',
      'username',
      'firstName',
      'lastName'
    ];
    const queryString = 'user?fields=' + this.buildValues(fields);
    return this.get(queryString);
  }

  //
  // Local helpers
  //
  private buildValues(collection: any[]): string {
    let values = '';
    _.each(collection, function (a) {
      values += a + '|';
    });
    // trim the last |
    return values.replace(/\|$/, '');
  }

  private get(apiRoute: string, options?: object) {
    return this.http.get(`${this.apiPath}/${apiRoute}`, options || null);
  }

  private put(apiRoute: string, body?: object, options?: object) {
    return this.http.put(`${this.apiPath}/${apiRoute}`, body || null, options || null);
  }

  private post(apiRoute: string, body?: object, options?: object) {
    return this.http.post(`${this.apiPath}/${apiRoute}`, body || null, options || null);
  }
  private delete(apiRoute: string, body?: object, options?: object) {
    return this.http.delete(`${this.apiPath}/${apiRoute}`, options || null);
  }
}
