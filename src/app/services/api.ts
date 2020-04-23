import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import * as _ from 'lodash';

import { Project } from 'app/models/project';
import { Feature } from 'app/models/feature';
import { Comment } from 'app/models/comment';
import { CommentPeriod } from 'app/models/commentperiod';
import { Document } from 'app/models/document';
import { SearchResults } from 'app/models/search';
import { Org } from 'app/models/organization';
import { Decision } from 'app/models/decision';
import { User } from 'app/models/user';
import { Utils } from 'app/shared/utils/utils';

@Injectable()
export class ApiService {
  // public token: string;
  public isMS: boolean; // IE, Edge, etc
  public apiPath: string;
  public adminUrl: string;
  public env: string;  // Could be anything per Openshift settings but generally is one of 'local' | 'dev' | 'test' | 'prod' | 'demo'


  constructor(
    private http: HttpClient,
    private utils: Utils
  ) {
    // const currentUser = JSON.parse(window.localStorage.getItem('currentUser'));
    // this.token = currentUser && currentUser.token;
    this.isMS = window.navigator.msSaveOrOpenBlob ? true : false;

    // The following items are loaded by a file that is only present on cluster builds.
    // Locally, this will be empty and local defaults will be used.
    const remote_api_path = window.localStorage.getItem('from_public_server--remote_api_path');
    const remote_admin_path = window.localStorage.getItem('from_public_server--remote_admin_path');
    const deployment_env = window.localStorage.getItem('from_public_server--deployment_env');

    this.apiPath = (_.isEmpty(remote_api_path)) ? 'http://localhost:3000/api/public' : remote_api_path;
    this.adminUrl = (_.isEmpty(remote_admin_path)) ? 'http://localhost:4200/admin' : remote_admin_path;
    this.env = (_.isEmpty(deployment_env)) ? 'local' : deployment_env;
  }

  handleError(error: any): Observable<any> {
    const reason = error.message ? error.message : (error.status ? `${error.status} - ${error.statusText}` : 'Server error');
    console.log('API error =', reason);
    return throwError(error);
  }

  getFullDataSet(dataSet: string): Observable<any> {
    return this.http.get<any>(`${this.apiPath}/search?pageSize=1000&dataset=${dataSet}`, {});
  }

  public async downloadDocument(document: Document): Promise<void> {
    let blob;
    try {
      blob = await this.downloadResource(document._id)
    } catch (e) {
      throw new Error(e)
    }
    if (!blob) {
      throw new Error()
    }
    let filename = document.displayName;
    filename = this.utils.encodeString(filename, false)
    if (this.isMS) {
      window.navigator.msSaveBlob(blob, filename);
    } else {
      const url = window.URL.createObjectURL(blob);
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
    let filename;
    if (document.documentSource === 'COMMENT') {
      filename = document.internalOriginalName;
    } else {
      filename = document.documentFileName;
    }
    console.log(document);
    let safeName = '';
    try {
      safeName = this.utils.encodeString(filename, true);
    } catch (e) {
      // fall through
      console.log('error', e);
    }
    console.log('safeName', safeName);
    window.open('/api/public/document/' + document._id + '/download/' + safeName, '_blank');
  }

  private downloadResource(id: string): Promise<Blob> {
    const queryString = `document/${id}/download`;
    return this.http.get<Blob>(this.apiPath + '/' + queryString, { responseType: 'blob' as 'json' }).toPromise();
  }

  getItem(_id: string, schema: string): Observable<SearchResults[]> {
    let queryString = `search?dataset=Item&_id=${_id}&_schemaName=${schema}`;
    return this.http.get<SearchResults[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Searching
  //
  searchKeywords(keys: string, dataset: string, fields: any[], pageNum: number, pageSize: number, projectLegislation: string = null, sortBy: string = null, queryModifier: object = {}, populate = false, secondarySort: string = null, filter: object = {}): Observable<SearchResults[]> {
    projectLegislation = (projectLegislation === '') ? 'default' : projectLegislation;
    let queryString = `search?dataset=${dataset}`;
    if (fields && fields.length > 0) {
      fields.forEach(item => {
        queryString += `&${item.name}=${item.value}`;
      });
    }
    if (keys) {
      queryString += `&keywords=${keys}`;
    }
    if (pageNum !== null) { queryString += `&pageNum=${pageNum - 1}`; }
    if (pageSize !== null) { queryString += `&pageSize=${pageSize}`; }
    if (projectLegislation !== '') { queryString += `&projectLegislation=${projectLegislation}`; }
    if (sortBy !== null) { queryString += `&sortBy=${sortBy}`; }
    if (secondarySort !== null) { queryString += `&sortBy=${secondarySort}`; }
    if (populate !== null) { queryString += `&populate=${populate}`; }
    if (queryModifier !== {}) {
      Object.keys(queryModifier).forEach(key => {
        queryModifier[key].split(',').forEach(item => {
          queryString += `&and[${key}]=${item}`;
        });
      });
    }
    if (filter !== {}) {
      let safeItem;
      Object.keys(filter).map(key => {
        filter[key].split(',').map(item => {
          if (item.includes('&')) {
            safeItem = this.utils.encodeString(item, true);
          } else {
            safeItem = item;
          }
          queryString += `&and[${key}]=${safeItem}`;
        });
      });
    }
    queryString += `&fields=${this.buildValues(fields)}`;
    return this.http.get<SearchResults[]>(`${this.apiPath}/${queryString}`, {});
    // if (dataset === 'Project') {
    //   searchResults = searchResults.currentProjectData
    // }
  }

  //
  // Projects
  //
  getCountProjects(): Observable<number> {
    const queryString = `project`;
    return this.http.head<HttpResponse<Object>>(`${this.apiPath}/${queryString}`, { observe: 'response' })
      .pipe(
        map(res => {
          // retrieve the count from the response headers
          return parseInt(res.headers.get('x-total-count'), 10);
        })
      );
  }

  //
  // Using Search Service Instead
  //
  // getProjects(pageNum: number, pageSize: number, sortBy: string, populate: Boolean = true):

   //
  // Using Search Service Instead
  //
  // getProject(id: string, cpStart: string, cpEnd: string): Observable<Project[]>

  getProjectPins(id: string, pageNum: number, pageSize: number, sortBy: any): Observable<Org> {
    let queryString = `project/${id}/pin`;
    if (pageNum !== null) { queryString += `?pageNum=${pageNum - 1}`; }
    if (pageSize !== null) { queryString += `&pageSize=${pageSize}`; }
    if (sortBy !== '' && sortBy !== null) { queryString += `&sortBy=${sortBy}`; }
    return this.http.get<any>(`${this.apiPath}/${queryString}`, {});
  }

  // CAC
  cacSignUp(project: Project, meta: any) {
    // We are just looking for a 200 OK
    return this.http.post<any>(`${this.apiPath}/project/${project._id}/cacSignUp`, meta, {});
  }

  cacRemoveMember(projectId: String, meta: any) {
    // We are just looking for a 200 OK
    return this.http.put<any>(`${this.apiPath}/project/${projectId}/cacRemoveMember`, meta, {});
  }

  // Organizations

  getOrgsByCompanyType(type: string): Observable<Org[]> {
    const fields = [
      'name'
    ];

    const queryString = `organization?companyType=${type}&sortBy=+name&fields=${this.buildValues(fields)}`;
    return this.http.get<Org[]>(`${this.apiPath}/${queryString}`, {});
  }

  getProjects(pageNum: number, pageSize: number, regions: string[], cpStatuses: string[], appStatuses: string[], applicant: string,	  //
    clFile: string, dispId: string, purpose: string): Observable<Project[]> {	  // Using Search Service Instead
    const fields = [	  //
      'agency',	  // getProjects(pageNum: number, pageSize: number, sortBy: string, populate: Boolean = true):
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
      'sector',
      'status',
      'subpurpose',
      'tantalisID',
      'tenureStage',
      'type',
      'legislation',
      'featuredDocuments',
      'projectCAC',
      'cacEmail'
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

    return this.http.get<Project[]>(`${this.apiPath}/${queryString}`, {});
  }

  getProject(id: string, cpStart: string, cpEnd: string): Observable<Project[]> {	   //
    const fields = [	  // Using Search Service Instead
      'CEAAInvolvement',	  //
      'CELead',	  // getProject(id: string, cpStart: string, cpEnd: string): Observable<Project[]>
      'CELeadEmail',
      'CELeadPhone',
      'centroid',
      'description',
      'eacDecision',
      'location',
      'name',
      'projectLeadId',
      'projectLead',
      'projectLeadEmail',
      'projectLeadPhone',
      'proponent',
      'region',
      'responsibleEPDId',
      'responsibleEPD',
      'responsibleEPDEmail',
      'responsibleEPDPhone',
      'type',
      'legislation',
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
      'legislation',
      'substitution',
      'featuredDocuments',
      'updatedBy',
      'read',
      'write',
      'delete',
      'featuredDocuments',
      'projectCAC',
      'cacEmail'
    ];
    let queryString = `project/${id}?populate=true`;
    if (cpStart !== null) { queryString += `&cpStart[since]=${cpStart}`; }
    if (cpEnd !== null) { queryString += `&cpEnd[until]=${cpEnd}`; }
    queryString += `&fields=${this.buildValues(fields)}`;
    return this.http.get<Project[]>(`${this.apiPath}/${queryString}`, {});
  }
  // TODO: delete these "Applications" calls, cruft.
  //
  // Applications
  //
  getCountApplications(): Observable<number> {
    const queryString = `application`;
    return this.http.head<HttpResponse<Object>>(`${this.apiPath}/${queryString}`, { observe: 'response' })
      .pipe(
        map(res => {
          // retrieve the count from the response headers
          return parseInt(res.headers.get('x-total-count'), 10);
        })
      );
  }

  getApplications(pageNum: number, pageSize: number, regions: string[], cpStatuses: string[], appStatuses: string[], applicant: string,
    clFile: string, dispId: string, purpose: string): Observable<Object> {
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

    return this.http.get<Object>(`${this.apiPath}/${queryString}`, {});
  }

  getApplication(id: string): Observable<Object> {
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
    return this.http.get<Object>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Features
  //
  getFeaturesByTantalisId(tantalisID: number): Observable<Feature[]> {
    const fields = [
      'applicationID',
      'geometry',
      'geometryName',
      'properties',
      'type'
    ];
    const queryString = `feature?tantalisId=${tantalisID}&fields=${this.buildValues(fields)}`;
    return this.http.get<Feature[]>(`${this.apiPath}/${queryString}`, {});
  }

  getFeaturesByApplicationId(applicationId: string): Observable<Feature[]> {
    const fields = [
      'applicationID',
      'geometry',
      'geometryName',
      'properties',
      'type'
    ];
    const queryString = `feature?applicationId=${applicationId}&fields=${this.buildValues(fields)}`;
    return this.http.get<Feature[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Decisions
  //
  getDecisionByAppId(appId: string): Observable<Decision[]> {
    const fields = [
      '_addedBy',
      '_application',
      'name',
      'description'
    ];
    const queryString = 'decision?_application=' + appId + '&fields=' + this.buildValues(fields);
    return this.http.get<Decision[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDecision(id: string): Observable<Decision[]> {
    const fields = [
      '_addedBy',
      '_application',
      'name',
      'description'
    ];
    const queryString = 'decision/' + id + '?fields=' + this.buildValues(fields);
    return this.http.get<Decision[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Comment Periods
  //
  getPeriodsByProjId(projId: string): Observable<Object> {
    const fields = [
      'project',
      'dateStarted',
      'dateCompleted',
      'instructions'
    ];
    // TODO: May want to pass this as a parameter in the future.
    const sort = '&sortBy=-dateStarted';

    let queryString = 'commentperiod?project=' + projId + '&fields=' + this.buildValues(fields) + '&';
    if (sort !== null) { queryString += `sortBy=${sort}&`; }
    return this.http.get<Object>(`${this.apiPath}/${queryString}`, {});
  }

  getPeriod(id: string): Observable<CommentPeriod[]> {
    const fields = [
      'additionalText',
      'dateCompleted',
      'dateStarted',
      'informationLabel',
      'instructions',
      'openHouses',
      'project',
      'relatedDocuments'
    ];
    const queryString = 'commentperiod/' + id + '?fields=' + this.buildValues(fields);
    return this.http.get<CommentPeriod[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Comments
  //
  getCountCommentsById(commentPeriodId): Observable<number> {
    const queryString = `comment?period=${commentPeriodId}`;
    return this.http.head<HttpResponse<Object>>(`${this.apiPath}/${queryString}`, { observe: 'response' })
      .pipe(
        map(res => {
          // retrieve the count from the response headers
          return parseInt(res.headers.get('x-total-count'), 10);
        })
      );
  }

  getCommentsByPeriodId(pageNum: number, pageSize: number, getCount: boolean, periodId: string): Observable<Object> {
    const fields = [
      'author',
      'comment',
      'documents',
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
    const sort = '-commentId';

    let queryString = 'comment?period=' + periodId + '&fields=' + this.buildValues(fields) + '&';
    if (sort !== null) { queryString += `sortBy=${sort}&`; }
    if (pageNum !== null) { queryString += `pageNum=${pageNum}&`; }
    if (pageSize !== null) { queryString += `pageSize=${pageSize}&`; }
    if (getCount !== null) { queryString += `count=${getCount}&`; }
    return this.http.get<Object>(`${this.apiPath}/${queryString}`, { observe: 'response' });
  }

  getComment(id: string): Observable<any> {
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
    return this.http.get<any>(`${this.apiPath}/${queryString}`, { observe: 'response' });
  }

  addComment(comment: Comment): Observable<Comment> {
    const fields = [
      'comment',
      'author'
    ];
    const queryString = 'comment?fields=' + this.buildValues(fields);
    return this.http.post<Comment>(`${this.apiPath}/${queryString}`, comment, {});
  }

  //
  // Documents
  //
  getDocumentsByAppId(appId: string): Observable<Document[]> {
    const fields = [
      '_application',
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime',
      'isFeatured'
    ];
    const queryString = 'document?_application=' + appId + '&fields=' + this.buildValues(fields);
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocumentsByCommentId(commentId: string): Observable<Document[]> {
    const fields = [
      '_comment',
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime',
      'isFeatured'
    ];
    const queryString = 'document?_comment=' + commentId + '&fields=' + this.buildValues(fields);
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocumentsByDecisionId(decisionId: string): Observable<Document[]> {
    const fields = [
      '_decision',
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime',
      'isFeatured'
    ];
    const queryString = 'document?_decision=' + decisionId + '&fields=' + this.buildValues(fields);
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocument(id: string): Observable<Document[]> {
    const queryString = 'document/' + id + '?fields=internalOriginalName|documentSource';
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocumentsByMultiId(ids: Array<String>): Observable<Document[]> {
    const fields = [
      'eaoStatus',
      'internalOriginalName',
      'documentFileName',
      'labels',
      'internalOriginalName',
      'displayName',
      'documentType',
      'datePosted',
      'dateUploaded',
      'dateReceived',
      'documentFileSize',
      'documentSource',
      'internalURL',
      'internalMime',
      'checkbox',
      'project',
      'type',
      'documentAuthor',
      'documentAuthorType',
      'milestone',
      'description',
      'isPublished',
      'isFeatured'
    ];
    const queryString = `document?docIds=${this.buildValues(ids)}&fields=${this.buildValues(fields)}`;
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  uploadDocument(formData: FormData): Observable<Document> {
    const fields = [
      'documentFileName',
      'displayName',
      'internalURL',
      'internalMime'
    ];
    const queryString = 'document/?fields=' + this.buildValues(fields);
    return this.http.post<Document>(`${this.apiPath}/${queryString}`, formData, {});
  }

  getDocumentUrl(document: Document): string {
    return document ? (this.apiPath + '/document/' + document._id + '/download') : '';
  }

  getTopNewsItems(): Observable<any[]> {
    const queryString = 'recentActivity?top=true';
    return this.http.get<any[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Users
  //
  getAllUsers(): Observable<User[]> {
    const fields = [
      'displayName',
      'username',
      'firstName',
      'lastName'
    ];
    const queryString = 'user?fields=' + this.buildValues(fields);
    return this.http.get<User[]>(`${this.apiPath}/${queryString}`, {});
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
}
