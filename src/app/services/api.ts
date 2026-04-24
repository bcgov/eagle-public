import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';

import { Project } from 'app/models/project';
import { Comment } from 'app/models/comment';
import { CommentPeriod } from 'app/models/commentperiod';
import { Document } from 'app/models/document';
import { SearchResults } from 'app/models/search';
import { Org } from 'app/models/organization';
import { Decision } from 'app/models/decision';
import { Utils } from 'app/shared/utils/utils';
import { LoggingService } from './logging.service';
import { ConfigService } from './config.service';
import { AnalyticsService } from './analytics/analytics.service';

@Injectable({providedIn:'root'})
export class ApiService {
  private http = inject(HttpClient);
  private utils = inject(Utils);
  private logger = inject(LoggingService);
  private configService = inject(ConfigService);
  private analytics = inject(AnalyticsService);

  // public token: string;
  public isMS: boolean; // IE, Edge, etc

  constructor() {
    // const currentUser = JSON.parse(window.localStorage.getItem('currentUser'));
    // this.token = currentUser && currentUser.token;
    this.isMS = !!(window.navigator as any).msSaveOrOpenBlob;
  }

  // Configuration getters - delegated to ConfigService
  get apiPath(): string {
    return this.configService.getApiPath();
  }

  get adminUrl(): string {
    return this.configService.config().ADMIN_PATH || 'http://localhost:4200/admin/';
  }

  get env(): string {
    return this.configService.config().ENVIRONMENT || 'local';
  }

  get bannerColour(): string {
    return this.configService.config().BANNER_COLOUR || 'red';
  }

  get surveyUrl(): string | null {
    return this.configService.config().SURVEY_URL || null;
  }

  get showSurveyBanner(): boolean {
    return this.configService.config().SHOW_SURVEY_BANNER ?? false;
  }

  handleError(error: any): Observable<any> {
    const reason = error.message ? error.message : (error.status ? `${error.status} - ${error.statusText}` : 'Server error');
    this.logger.error(`API error: ${reason}`, 'ApiService', error);
    return throwError(error);
  }

  getFullDataSet(dataSet: string, pageSize = 250): Observable<any> {
    return this.http.get<any>(`${this.apiPath}/search?pageSize=${pageSize}&dataset=${dataSet}`, {});
  }

  public async downloadDocument(document: Document): Promise<void> {
    // Track document download
    this.analytics.track('Document Downloaded', {
      document_id: document._id,
      document_name: document.displayName,
      document_type: document.internalMime || 'unknown'
    });

    let blob;
    try {
      blob = await this.downloadResource(document._id)
    } catch (e) {
      throw new Error(String(e))
    }
    if (!blob) {
      throw new Error()
    }
    let filename = document.displayName;
    filename = this.utils.encodeString(filename, false)
    if (this.isMS) {
      (window.navigator as any).msSaveBlob(blob, filename);
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
    // Track document opened
    this.analytics.track('Document Opened', {
      document_id: document._id,
      document_name: document.displayName || document.documentFileName,
      document_source: document.documentSource || 'unknown'
    });

    let filename;
    if (document.documentSource === 'COMMENT') {
      filename = document.internalOriginalName;
    } else {
      filename = document.documentFileName;
    }
    this.logger.debug('Opening document', 'ApiService', { document });
    let safeName = '';
    try {
      safeName = this.utils.encodeString(filename || '', true);
    } catch (e) {
      this.logger.warn('Failed to encode document filename', 'ApiService', e);
    }
    this.logger.debug('Opening document with safe name', 'ApiService', { safeName });
    window.open('/api/public/document/' + document._id + '/download/' + safeName, '_blank');
  }

  private async downloadResource(id: string): Promise<Blob> {
    const queryString = `document/${id}/download`;
    const blob = await this.http.get<Blob>(this.apiPath + '/' + queryString, { responseType: 'blob' as 'json' }).toPromise();
    if (!blob) {
      throw new Error('Failed to download document');
    }
    return blob;
  }

  getItem(_id: string, schema: string): Observable<SearchResults[]> {
    const queryString = `search?dataset=Item&_id=${_id}&_schemaName=${schema}`;
    return this.http.get<SearchResults[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Searching
  //
  searchKeywords(keys: string, dataset: string, fields: any[], pageNum: number, pageSize: number, projectLegislation = '', sortBy: string | null = null, queryModifier: Record<string, string> = {}, populate = false, secondarySort: string | null = null, filter: Record<string, string> = {}, fuzzy = false): Observable<SearchResults[]> {
    this.logger.debug(`API.searchKeywords called with keys: ${keys}`, 'ApiService', { filter });
    
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
    queryString += `&populate=${populate}`;
    Object.keys(queryModifier).forEach((key: string) => {
      queryModifier[key].split(',').forEach((item: string) => {
        queryString += `&and[${key}]=${item}`;
      });
    });
    let safeItem: string;
    Object.keys(filter).map((key: string) => {
      filter[key].split(',').map((item: string) => {
        if (item.includes('&')) {
          safeItem = this.utils.encodeString(item, true);
        } else {
          safeItem = item;
        }
        queryString += `&and[${key}]=${safeItem}`;
      });
    });
    queryString += `&fields=${this.buildValues(fields)}`;
    queryString += '&fuzzy=' + fuzzy;
    
    const fullUrl = `${this.apiPath}/${queryString}`;
    this.logger.trace(`API call URL: ${fullUrl}`, 'ApiService');
    
    return this.http.get<SearchResults[]>(fullUrl, {});
    // if (dataset === 'Project') {
    //   searchResults = searchResults.currentProjectData
    // }
  }

  //
  // Projects
  //
  getCountProjects(): Observable<number> {
    const queryString = `project`;
    return this.http.head<HttpResponse<object>>(`${this.apiPath}/${queryString}`, { observe: 'response' })
      .pipe(
        map(res => {
          // retrieve the count from the response headers
          return parseInt(res.headers.get('x-total-count') || '0', 10);
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

  cacRemoveMember(projectId: string, meta: any) {
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

  getProject(id: string, cpStart: string | null, cpEnd: string | null): Observable<Project[]> {
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
      'projectCACPublished',
      'cacEmail'
    ];
    let queryString = `project/${id}?populate=true`;
    if (cpStart !== null) { queryString += `&cpStart[since]=${cpStart}`; }
    if (cpEnd !== null) { queryString += `&cpEnd[until]=${cpEnd}`; }
    queryString += `&fields=${this.buildValues(fields)}`;
    return this.http.get<Project[]>(`${this.apiPath}/${queryString}`, {});
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
  getPeriodsByProjId(projId: string): Observable<object> {
    const fields = [
      'project',
      'dateStarted',
      'dateCompleted',
      'instructions',
      'isMet',
      'metURL',
    ];
    const queryString = `commentperiod?project=${projId}&sortBy=-dateStarted&fields=${this.buildValues(fields)}`;
    return this.http.get<object>(`${this.apiPath}/${queryString}`, {});
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
      'relatedDocuments',
      'commentTip'
    ];
    const queryString = 'commentperiod/' + id + '?fields=' + this.buildValues(fields);
    return this.http.get<CommentPeriod[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Comments
  //
  getCountCommentsById(commentPeriodId: string): Observable<number> {
    const queryString = `comment?period=${commentPeriodId}`;
    return this.http.head<HttpResponse<object>>(`${this.apiPath}/${queryString}`, { observe: 'response' })
      .pipe(
        map(res => {
          // retrieve the count from the response headers
          return parseInt(res.headers.get('x-total-count') || '0', 10);
        })
      );
  }

  getCommentsByPeriodId(pageNum: number | null, pageSize: number | null, getCount: boolean, periodId: string): Observable<object> {
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
    return this.http.get<object>(`${this.apiPath}/${queryString}`, { observe: 'response' });
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

  getDocumentsByNotificationId(notificationId: string): Observable<Document[]> {
    const fields = [
      'displayName',
      'documentFileName',
      'datePosted',
      'documentAuthor',
      'internalURL',
      'internalMime',
      'internalExt',
    ];
    const queryString = 'document?project=' + notificationId
      + '&documentSource=PROJECT-NOTIFICATION'
      + '&fields=' + this.buildValues(fields);
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocumentsByPcpId(pcpId: string): Observable<Document[]> {
    const fields = [
      '_comment',
      'displayName',
      'documentFileName',
      'datePosted',
      'documentAuthor',
      'internalURL',
      'internalMime',
      'internalExt',
    ];
    const queryString = 'document?_comment=' + pcpId + '&fields=' + this.buildValues(fields);
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocument(id: string): Observable<Document[]> {
    const queryString = 'document/' + id + '?fields=internalOriginalName|documentSource';
    return this.http.get<Document[]>(`${this.apiPath}/${queryString}`, {});
  }

  getDocumentsByMultiId(ids: string[]): Observable<Document[]> {
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

  getTopNewsItems(): Observable<any[]> {
    const queryString = 'public/recentActivity?top=true';
    return this.http.get<any[]>(`${this.apiPath}/${queryString}`, {});
  }

  //
  // Local helpers
  //
  private buildValues(collection: any[]): string {
    if (!collection || collection.length === 0) {
      return '';
    }
    let values = '';
    collection.forEach(function (a) {
      values += a + '|';
    });
    // trim the last |
    return values.replace(/\|$/, '');
  }
}
