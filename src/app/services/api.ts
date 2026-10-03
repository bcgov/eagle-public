import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { catchError, expand, map, mergeMap, reduce, take } from 'rxjs/operators';

import { Project } from 'app/models/project';
import { Comment } from 'app/models/comment';
import { CommentPeriod } from 'app/models/commentperiod';
import { Document } from 'app/models/document';
import { SearchResults } from 'app/models/search';
import { Org } from 'app/models/organization';
import { Utils } from 'app/shared/utils/utils';
import { documentDownloadUrl, DocumentUrlOptions } from 'app/shared/utils/legacy-document-url';
import { LoggingService } from './logging.service';
import { ConfigService } from './config.service';
import { AnalyticsService } from './analytics/analytics.service';

/** One page of a comment period's comments plus how many there are in total. */
export interface CommentPage {
  comments: any[];
  totalCount: number | null;
}

/** Rows out of the `[{searchResults, meta}]` envelope `/search` answers with. */
function rowsFrom<T>(envelope: any): T[] {
  return envelope?.[0]?.searchResults ?? [];
}

/** How many rows match, ignoring paging. `null` when the backend did not count. */
function totalFrom(envelope: any): number | null {
  const total = envelope?.[0]?.meta?.[0]?.searchResultsTotal;
  return typeof total === 'number' ? total : null;
}

/** `/search` ignores `fields=` and answers the whole stored record, so the projection happens here. */
function pickFields<T>(row: any, fields: string[]): T {
  return Object.fromEntries(Object.entries(row ?? {}).filter(([field]) => fields.includes(field))) as T;
}

/**
 * The banner's comment periods: those that start inside, end inside, or span the window, the
 * three branches of the old `cpStart`/`cpEnd` lookup.
 */
function periodsInWindow(periods: any[], since: string | null, until: string | null): any[] {
  if (since === null || until === null) { return []; }
  // An unreadable date is NaN, which fails every comparison below, so it matches nothing.
  const from = Date.parse(since);
  const to = Date.parse(until);
  const timeOf = (value: any): number => new Date(value ?? '').getTime();
  return periods.filter(period => {
    const started = timeOf(period?.dateStarted);
    const completed = timeOf(period?.dateCompleted);
    return (started >= from && started <= to)
      || (completed >= from && completed <= to)
      || (started <= from && completed >= to);
  });
}

/** List-backed project fields DEMI may answer as bare ids rather than populated rows. */
const LIST_REF_FIELDS = ['eacDecision', 'currentPhaseName', 'CEAAInvolvement'];

/**
 * A DEMI project document in the shape eagle-api's `/project/<id>` answered, so `Project` and the
 * pages reading it stay unchanged. Track spells `type`/`status`/`location` as
 * `projectType`/`projectState`/`address`; `centroid` is GeoJSON; the proponent is two scalars.
 * Fields DEMI does not carry (`CELead*`, `projectLeadId`, `responsibleEPDId`, ACLs) stay absent.
 */
function demiProjectToEagle(doc: any, commentPeriodForBanner: any[], lists: any[]): any {
  const resolveListRef = (value: any) => typeof value === 'string' ? lists.find(row => row._id === value) : value;
  const centroid = doc.centroid;
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
    commentPeriodForBanner,
  };
}

@Injectable({providedIn:'root'})
export class ApiService {
  private http = inject(HttpClient);
  private utils = inject(Utils);
  private logger = inject(LoggingService);
  private configService = inject(ConfigService);
  private analytics = inject(AnalyticsService);

  // demi-search 400s above 500 rows on a filtered search.
  private static readonly ORGS_PAGE_SIZE = 500;
  // 10,000 rows; stops endless paging should every page come back full.
  private static readonly ORGS_PAGE_CAP = 20;
  private static readonly ALL_ROWS_PAGE_SIZE = 250;
  // Long `docIds` URLs break near 320 ids.
  private static readonly DOC_IDS_PER_REQUEST = 300;

  /** demi-search: every public read. */
  get searchPath(): string {
    return this.configService.getSearchApiPath();
  }

  get demiProjectsPath(): string {
    return this.configService.getDemiProjectsPath();
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

  public async downloadDocument(document: Document): Promise<void> {
    // Track document download
    this.analytics.track('Document Downloaded', {
      document_id: document._id,
      document_name: document.displayName,
      document_type: document.internalMime || 'unknown'
    });

    const url = this.getDocumentUrl(document);
    // The frame below hides a failed transfer, so check first. DEMI answers HEAD itself, never redirecting.
    await firstValueFrom(this.http.head(url));

    // A hidden iframe: the redirect lands on a cross-origin file a blob fetch could not read.
    const frame = window.document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.src = url;
    window.document.body.appendChild(frame);
    // Removing the iframe cancels a transfer that has not started yet, so give it a minute.
    window.setTimeout(() => frame.remove(), 60_000);
  }

  public async openDocument(document: Document): Promise<void> {
    // Track document opened
    this.analytics.track('Document Opened', {
      document_id: document._id,
      document_name: document.displayName || document.documentFileName,
      document_source: document.documentSource || 'unknown'
    });
    window.open(this.getDocumentUrl(document, { inline: true }), '_blank');
  }

  /** The demi-search download URL for a document; also usable as an anchor href. */
  getDocumentUrl(document: { _id: string }, options?: DocumentUrlOptions): string {
    return documentDownloadUrl(this.searchPath, document._id, options);
  }

  //
  // Searching
  //
  searchKeywords(keys: string, dataset: string, fields: any[], pageNum: number | null, pageSize: number | null, projectLegislation = '', sortBy: string | null = null, queryModifier: Record<string, string> = {}, populate = false, secondarySort: string | null = null, filter: Record<string, string> = {}, fuzzy = false): Observable<SearchResults[]> {
    this.logger.debug(`API.searchKeywords called with keys: ${keys}`, 'ApiService', { filter });
    
    projectLegislation = (projectLegislation === '') ? 'default' : projectLegislation;
    let queryString = `search?dataset=${dataset}`;
    if (fields && fields.length > 0) {
      fields.forEach(item => {
        queryString += `&${item.name}=${item.value}`;
      });
    }
    if (keys) {
      queryString += `&keywords=${encodeURIComponent(keys)}`;
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
    // No `&fields=`: demi-search accepts it but reads nobody's; `fields` pairs are emitted above.
    queryString += '&fuzzy=' + fuzzy;

    const fullUrl = `${this.searchPath}/${queryString}`;
    this.logger.trace(`API call URL: ${fullUrl}`, 'ApiService');

    return this.http.get<SearchResults[]>(fullUrl, {});
  }

  //
  // Projects
  //
  getCountProjects(): Observable<number> {
    return this.searchKeywords('', 'Project', [], 1, 1).pipe(map(envelope => totalFrom(envelope) ?? 0));
  }

  /** The DEMI project document, or null when DEMI has no record for it. */
  private getDemiProject(id: string): Observable<any | null> {
    return this.http.get<any>(`${this.demiProjectsPath}/${encodeURIComponent(id)}`).pipe(
      catchError(error => error?.status === 404 ? of(null) : throwError(() => error))
    );
  }

  /**
   * One page of a project's pinned Nations in the `[{total_items, results}]` envelope pins.service
   * reads. DEMI carries them on the project document in stored order, so sort and page here.
   */
  getProjectPins(id: string, pageNum: number, pageSize: number, sortBy: any): Observable<Org> {
    return this.getDemiProject(id).pipe(
      map(doc => {
        const pins: any[] = [...(doc?.pins ?? [])];
        if (sortBy === '+name' || sortBy === '-name') {
          const direction = sortBy === '-name' ? -1 : 1;
          pins.sort((a, b) => direction * (a.name ?? '').localeCompare(b.name ?? ''));
        }
        const from = pageNum !== null && pageSize !== null ? (pageNum - 1) * pageSize : 0;
        const page = pageSize !== null ? pins.slice(from, from + pageSize) : pins;
        return [{ total_items: pins.length, results: page }] as unknown as Org;
      })
    );
  }

  // Organizations

  /** Every organization of one company type, paged until a short page. */
  getOrgsByCompanyType(type: string): Observable<Org[]> {
    const page = (pageNum: number) =>
      this.searchKeywords('', 'Organization', [], pageNum, ApiService.ORGS_PAGE_SIZE, '', '+name', { companyType: type })
        .pipe(map(envelope => ({ pageNum, rows: rowsFrom<Org>(envelope) })));
    return page(1).pipe(
      expand(({ pageNum, rows }) => {
        if (rows.length < ApiService.ORGS_PAGE_SIZE) { return EMPTY; }
        if (pageNum >= ApiService.ORGS_PAGE_CAP) {
          this.logger.warn(`Stopped reading ${type} organizations at the ${pageNum}-page cap`, 'ApiService');
          return EMPTY;
        }
        return page(pageNum + 1);
      }),
      reduce((orgs: Org[], { rows }) => orgs.concat(rows), [])
    );
  }

  /**
   * The one-element array eagle-api's `/project/<id>` answered, built from `GET /demi-projects/<id>`.
   * Empty when DEMI has no such project; the banner periods are read separately and windowed here.
   */
  getProject(id: string, cpStart: string | null, cpEnd: string | null): Observable<Project[]> {
    return this.getDemiProject(id).pipe(
      mergeMap(doc => {
        if (!doc) { return of([] as Project[]); }
        // A banner that cannot be read is a missing banner, never a missing project.
        const periods$ = cpStart !== null && cpEnd !== null
          ? this.getPeriodsByProjId(id).pipe(catchError(error => {
            this.logger.warn('Banner comment period read failed, showing no banner', 'ApiService', error);
            return of([] as CommentPeriod[]);
          }))
          : of([] as CommentPeriod[]);
        const lists$ = LIST_REF_FIELDS.some(field => typeof doc[field] === 'string')
          ? this.configService.lists.pipe(take(1))
          : of([]);
        return forkJoin([periods$, lists$]).pipe(
          map(([periods, lists]) => [demiProjectToEagle(doc, periodsInWindow(periods, cpStart, cpEnd), lists ?? [])] as Project[])
        );
      })
    );
  }

  //
  // Comment Periods
  //
  /** Every comment period of one project, newest first. A project has single-digit periods. */
  getPeriodsByProjId(projId: string): Observable<CommentPeriod[]> {
    return this.searchKeywords('', 'CommentPeriod', [], 1, ApiService.ALL_ROWS_PAGE_SIZE, '', '-dateStarted', { project: projId })
      .pipe(map(envelope => rowsFrom(envelope).map(period => pickFields<CommentPeriod>(period, ApiService.PERIOD_LIST_FIELDS))));
  }

  /** One comment period, filtered as `and[_id]`: a bare `_id` is not read as a filter. */
  getPeriod(id: string): Observable<CommentPeriod[]> {
    return this.searchKeywords('', 'CommentPeriod', [], 1, 1, '', null, { _id: id })
      .pipe(map(envelope => rowsFrom(envelope).map(period => pickFields<CommentPeriod>(period, ApiService.PERIOD_DETAIL_FIELDS))));
  }

  // DEMI's visibility catalog decides what is public; these projections only trim the object.
  // The full record also carries `additionalText`, which the cards would show in place of the description.
  private static readonly PERIOD_LIST_FIELDS = [
    '_id',
    'project',
    'dateStarted',
    'dateCompleted',
    'instructions',
    'isMet',
    'metURL',
    'metBannerImageUrl',
    'informationLabel',
  ];

  private static readonly PERIOD_DETAIL_FIELDS = [
    '_id',
    'additionalText',
    'dateCompleted',
    'dateStarted',
    'informationLabel',
    'instructions',
    'isMet',
    'metURL',
    'openHouses',
    'project',
    'relatedDocuments',
    'commentTip'
  ];

  //
  // Comments
  //
  getCountCommentsById(commentPeriodId: string): Observable<number> {
    return this.searchKeywords('', 'Comment', [], 1, 1, '', null, { period: commentPeriodId })
      .pipe(map(envelope => totalFrom(envelope) ?? 0));
  }

  /** One page of a period's comments, newest first. `pageNum` is zero-based here. */
  getCommentsByPeriodId(pageNum: number | null, pageSize: number | null, periodId: string): Observable<CommentPage> {
    return this.searchKeywords('', 'Comment', [], pageNum === null ? null : pageNum + 1, pageSize, '', '-commentId', { period: periodId })
      .pipe(map(envelope => ({ comments: rowsFrom(envelope), totalCount: totalFrom(envelope) })));
  }

  getComment(id: string): Observable<Comment[]> {
    return this.searchKeywords('', 'Comment', [], 1, 1, '', null, { _id: id })
      .pipe(map(envelope => rowsFrom<Comment>(envelope)));
  }

  //
  // Documents
  //
  getDocument(id: string): Observable<Document[]> {
    return this.getDocumentsByMultiId([id]);
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
    if (ids.length === 0) { return of([]); }
    const batches: string[][] = [];
    for (let from = 0; from < ids.length; from += ApiService.DOC_IDS_PER_REQUEST) {
      batches.push(ids.slice(from, from + ApiService.DOC_IDS_PER_REQUEST));
    }
    const position = new Map(ids.map((id, index) => [id, index]));
    // demi-search reads `docIds` bare and pipe-separated.
    return forkJoin(batches.map(batch =>
      this.searchKeywords('', 'Document', [{ name: 'docIds', value: this.buildValues(batch) }], 1, batch.length)
        .pipe(map(envelope => rowsFrom<any>(envelope)))
    )).pipe(map(pages => pages.flat()
      .sort((a, b) => (position.get(a._id) ?? Infinity) - (position.get(b._id) ?? Infinity))
      .map(row => pickFields<Document>({
        ...row,
        // The index holds no `internalOriginalName`, the only label the comment attachment list renders.
        internalOriginalName: row.internalOriginalName ?? row.documentFileName ?? row.displayName,
      }, ['_id', ...fields]))));
  }

  /** The pinned and newest updates for the home page strip. */
  getTopNewsItems(): Observable<any[]> {
    return this.http.get<SearchResults[]>(`${this.searchPath}/search?dataset=RecentActivity&top=true`, {})
      .pipe(map(envelope => rowsFrom<any>(envelope)));
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
