import {
  Component, ChangeDetectionStrategy, inject, input, computed, signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, distinctUntilChanged, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';
import { Utils } from 'app/shared/utils/utils';
import { highlightField } from 'app/search/search-collections';

@Component({
  selector: 'app-search-notification-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  template: `
    <article class="search-result-card search-result-card--styled mb-3">

      <!-- ── Header ─────────────────────────────────────────────────── -->
      <div class="search-card-header">
        <h5 class="mb-0" [innerHTML]="hl('name') || 'Untitled'"></h5>
      </div>

      <!-- ── Engagement banner ──────────────────────────────────────── -->
      @if (engageLink()) {
        <div class="d-flex align-items-center gap-2 flex-wrap px-3 py-2 bg-success-subtle border-bottom border-success-subtle small">
          <i class="material-icons" style="font-size:1.1em;color:var(--bs-success)">forum</i>
          <span class="fw-semibold">Comment Period:</span>
          <span class="pcp-status pcp-status--{{ rowData().pcp }}">{{ rowData().pcp | titlecase }}</span>
          <a class="btn btn-sm btn-success ms-auto"
             [href]="engageLink()" target="_blank" rel="noopener noreferrer">
            View Engagement
          </a>
        </div>
      }

      <!-- ── Body ───────────────────────────────────────────────────── -->
      <div class="search-card-content">

        <!-- Field grid -->
        <div class="row row-cols-2 row-cols-md-3 g-2">
          @if (rowData().type) {
            <div class="col">
              <div class="search-result-card-label">Type</div>
              <div class="search-result-card-value">{{ rowData().type }}</div>
            </div>
          }
          @if (rowData().subType) {
            <div class="col">
              <div class="search-result-card-label">Sub-Type</div>
              <div class="search-result-card-value" [innerHTML]="hl('subType')"></div>
            </div>
          }
          @if (rowData().proponent) {
            <div class="col">
              <div class="search-result-card-label">Proponent</div>
              <div class="search-result-card-value" [innerHTML]="hl('proponent')"></div>
            </div>
          }
          @if (rowData().region) {
            <div class="col">
              <div class="search-result-card-label">Region</div>
              <div class="search-result-card-value" [innerHTML]="hl('region')"></div>
            </div>
          }
          @if (rowData().location) {
            <div class="col">
              <div class="search-result-card-label">Location</div>
              <div class="search-result-card-value" [innerHTML]="hl('location')"></div>
            </div>
          }
          @if (rowData().trigger) {
            <div class="col">
              <div class="search-result-card-label">Notification Trigger</div>
              <div class="search-result-card-value">{{ rowData().trigger }}</div>
            </div>
          }
          @if (rowData().decision) {
            <div class="col">
              <div class="search-result-card-label">Decision</div>
              <div class="search-result-card-value">{{ rowData().decision }}</div>
            </div>
          }

          @if (rowData()._receivedDate) {
            <div class="col">
              <div class="search-result-card-label">Date Received</div>
              <div class="search-result-card-value">
                {{ rowData()._receivedDate | date:'yyyy-MM-dd' }}
              </div>
            </div>
          }
          @if (rowData().associatedProjectName) {
            <div class="col">
              <div class="search-result-card-label">Project</div>
              <div class="search-result-card-value" [innerHTML]="hl('associatedProjectName')"></div>
            </div>
          }
        </div>

        @if (safeDescription()) {
          <hr class="my-2">
          <div class="search-result-content" [innerHTML]="safeDescription()"></div>
        }

        <!-- Action buttons -->
        @if (rowData().associatedProjectId) {
          <div class="d-flex flex-wrap gap-2 mt-3">
            <a class="btn btn-sm btn-outline-primary"
              [href]="'/p/' + rowData().associatedProjectId">
              View Project
            </a>
          </div>
        }

      </div>

      <!-- ── Accordion footer ─────────────────────────────────────── -->

      <!-- Comment Periods panel: show while loading (undefined !== null), when a full CP doc
           exists, or when the notification has a pcp status string without a linked CP record. -->
      @if (pcpDetails() !== null || (rowData().pcp && rowData().pcp !== 'none')) {
      <button class="notif-accordion-toggle" type="button" (click)="togglePcp()">
        <span>Comment Periods
          @if (pcpDetails() === undefined) {
            <span class="notif-accordion-spinner"></span>
          } @else {
            <span class="notif-accordion-count">1</span>
          }
        </span>
        <i class="material-icons">{{ pcpOpen() ? 'expand_less' : 'expand_more' }}</i>
      </button>
      <div class="notif-accordion-wrapper" [class.open]="pcpOpen()"><div class="notif-doc-section px-3">
          @if (pcpDetails() === undefined) {
            <p class="text-muted small py-2 mb-0">Loading…</p>
          } @else if (pcpDetails()) {
          <!-- Full CP record: show status, dates, and link. -->
          <div class="d-flex align-items-center gap-3 py-2 notif-doc-row">
            @if (pcpStatus()) {
              <span class="pcp-status pcp-status--{{ pcpStatus() }}">{{ pcpStatus() | titlecase }}</span>
            }
            <span class="small text-muted">{{ pcpDetails()!['dateStarted'] | date:'yyyy-MM-dd' }} – {{ pcpDetails()!['dateCompleted'] | date:'yyyy-MM-dd' }}</span>
            <a class="notif-doc-col-action btn btn-sm btn-link flex-shrink-0 p-0 ms-auto"
              [href]="'/pn/' + rowData()._id + '/cp/' + pcpDetails()!['_id']"
              title="View Comment Period">
              <i class="material-icons" style="font-size:20px;vertical-align:middle">open_in_new</i>
            </a>
          </div>
          } @else if (rowData().pcp && rowData().pcp !== 'none') {
          <!-- Status-only: pcp string on notification; dates from rowData when set by admin. -->
          <div class="d-flex align-items-center gap-3 py-2 notif-doc-row">
            <span class="pcp-status pcp-status--{{ rowData().pcp }}">{{ rowData().pcp | titlecase }}</span>
            @if (rowData().dateStarted || rowData().dateCompleted) {
              <span class="small text-muted">{{ rowData().dateStarted | date:'yyyy-MM-dd' }} – {{ rowData().dateCompleted | date:'yyyy-MM-dd' }}</span>
            }
            @if (engageLink()) {
              <a class="notif-doc-col-action btn btn-sm btn-link flex-shrink-0 p-0 ms-auto"
                [href]="engageLink()!"
                target="_blank" rel="noopener noreferrer"
                title="View Engagement">
                <i class="material-icons" style="font-size:20px;vertical-align:middle">open_in_new</i>
              </a>
            }
          </div>
          }
        </div></div>
      }

      <!-- Documents panel: show while loading (undefined) or when loaded with docs; hide only if loaded+empty -->
      @if (documents() === undefined || documents()!.length > 0) {
      <button class="notif-accordion-toggle" type="button" (click)="toggleDocs()">
        <span>Documents
          @if (documents() === undefined) {
            <span class="notif-accordion-spinner"></span>
          } @else {
            <span class="notif-accordion-count">{{ documents()!.length }}</span>
          }
        </span>
        <i class="material-icons">{{ docsOpen() ? 'expand_less' : 'expand_more' }}</i>
      </button>
      <div class="notif-accordion-wrapper" [class.open]="docsOpen()"><div class="notif-doc-section px-3">
          @if (documents() === undefined) {
            <p class="text-muted small py-2 mb-0">Loading…</p>
          } @else {
            <div class="d-none d-md-flex align-items-center gap-3 px-0 py-1 small fw-semibold notif-doc-header rounded-1 mb-1">
              <span class="flex-fill">Document Name</span>
              <span class="notif-doc-col-date">Date Posted</span>
              <span class="notif-doc-col-author">Author</span>
              <span class="notif-doc-col-action"></span>
            </div>
            @for (doc of (documents() ?? []); track doc['_id']) {
              <div class="d-flex flex-column flex-md-row align-items-md-center gap-1 gap-md-3 py-2 notif-doc-row">
                <span class="flex-fill small notif-doc-name">
                  {{ doc['displayName'] || doc['documentFileName'] || 'Untitled' }}
                </span>
                <span class="text-muted small d-none d-md-block notif-doc-col-date">
                  {{ doc['datePosted'] | date:'yyyy-MM-dd' }}
                </span>
                <span class="text-muted small d-none d-md-block text-truncate notif-doc-col-author"
                  [title]="authorName(doc['documentAuthor'])">
                  {{ authorName(doc['documentAuthor']) }}
                </span>
                <div class="d-flex d-md-none gap-2 text-muted small">
                  @if (doc['datePosted']) {
                    <span>{{ doc['datePosted'] | date:'yyyy-MM-dd' }}</span>
                  }
                  @if (authorName(doc['documentAuthor'])) {
                    <span>&bull; {{ authorName(doc['documentAuthor']) }}</span>
                  }
                </div>
                <a class="notif-doc-col-action btn btn-sm btn-link flex-shrink-0 p-0"
                  [href]="'/api/document/' + doc['_id'] + '/fetch'"
                  target="_blank" rel="noopener noreferrer"
                  title="Download">
                  <i class="material-icons" style="font-size:20px;vertical-align:middle">file_download</i>
                </a>
              </div>
            }
          }
        </div></div>
      }

    </article>
  `,
  styles: [`
    .pcp-status { display: inline-flex; align-items: center; gap: 5px; font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.55rem; border-radius: 999px; }
    .pcp-status::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .pcp-status--open    { background: rgba(46,133,64,.12); color: #2e8540; }
    .pcp-status--open::before    { background: #2e8540; }
    .pcp-status--pending { background: rgba(252,186,25,.15); color: #9a6c00; }
    .pcp-status--pending::before { background: #fcba19; }
    .pcp-status--closed  { background: rgba(216,41,47,.10); color: #d8292f; }
    .pcp-status--closed::before  { background: #d8292f; }
    .notif-accordion-wrapper { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 200ms ease-in-out; }
    .notif-accordion-wrapper.open { grid-template-rows: 1fr; }
    .notif-doc-section { overflow: hidden; min-height: 0; background: var(--table-row-bg); }
    .notif-doc-header { background: var(--bs-secondary-bg, #e9ecef); color: var(--bs-secondary-color, #6c757d); }
    .notif-doc-row { border-bottom: 1px solid var(--bs-border-color, #dee2e6); font-size: .875rem; }
    .notif-doc-row:last-child { border-bottom: none; }
    .notif-doc-name { word-break: break-word; }
    .notif-doc-col-date   { width: 100px; flex-shrink: 0; white-space: nowrap; }
    .notif-doc-col-author { width: 160px; flex-shrink: 0; overflow: hidden; }
    .notif-doc-col-action { width: 38px; flex-shrink: 0; padding: 0.15rem 0.35rem; }
    .notif-accordion-toggle {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 0.4rem 1rem; background: var(--table-row-bg);
      border: none; border-top: 1px solid var(--bs-border-color, #dee2e6);
      border-bottom: 1px solid var(--bs-border-color, #dee2e6);
      color: var(--bs-secondary-color, #6c757d);
      font-size: 0.8125rem; font-weight: 600; cursor: pointer; text-align: left;
    }
    .notif-accordion-toggle:hover { filter: brightness(0.95); }
    .notif-accordion-toggle .material-icons { font-size: 1.1rem; }
    .notif-accordion-count {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--bs-border-color, #dee2e6); color: var(--bs-body-color, #212529);
      border-radius: 999px; font-size: 0.7rem; font-weight: 700;
      min-width: 1.25rem; height: 1.25rem; padding: 0 0.3rem; margin-left: 0.35rem;
    }
    .notif-accordion-spinner {
      display: inline-block; width: 0.75rem; height: 0.75rem; margin-left: 0.4rem; vertical-align: middle;
      border: 2px solid var(--bs-border-color, #dee2e6); border-top-color: var(--bs-secondary-color, #6c757d);
      border-radius: 50%; animation: notif-spin 0.7s linear infinite;
    }
    @keyframes notif-spin { to { transform: rotate(360deg); } }
  `],
})
export class SearchNotificationCardComponent {
  rowData = input.required<any>();

  /** Engage URL — present when isMet=true and metURL is set. */
  engageLink = computed((): string | null =>
    (this.rowData().isMet && this.rowData().metURL) ? this.rowData().metURL : null
  );

  pcpOpen  = signal(false);
  docsOpen = signal(false);

  togglePcp():  void { this.pcpOpen.update(v => !v); }
  toggleDocs(): void { this.docsOpen.update(v => !v); }

  private sanitizer     = inject(DomSanitizer);
  private configService = inject(ConfigService);
  private utils         = inject(Utils);
  private api           = inject(ApiService);

  /** Documents fetched lazily; auto-cancelled via switchMap when rowData._id changes. */
  readonly documents = toSignal(
    toObservable(this.rowData).pipe(
      map(rd => rd?._id as string | undefined),
      distinctUntilChanged(),
      switchMap(id => id
        ? this.api.getDocumentsByNotificationId(id).pipe(
            map((docs: any) => Array.isArray(docs) ? docs : []),
            catchError(() => of([])),
          )
        : of([])
      ),
    ),
  );

  /** First comment period; fetched eagerly on render — same lifecycle as `documents`.
   *  `undefined` while loading, `null` when none found, CP object when found. */
  readonly pcpDetails = toSignal(
    toObservable(this.rowData).pipe(
      map(rd => rd?._id as string | undefined),
      distinctUntilChanged(),
      switchMap(id => id
        ? this.api.getPeriodsByProjId(id).pipe(
            map((res: any) => Array.isArray(res) ? (res[0] ?? null) : null),
            catchError(() => of(null)),
          )
        : of(null)
      ),
    ),
  );

  /**
   * PCP status chip label: uses Typesense `pcp` field when set, otherwise
   * derives open/pending/closed from the fetched period dates.
   */
  readonly pcpStatus = computed((): string | null => {
    const direct = this.rowData().pcp as string | null;
    if (direct) return direct;
    const pd = this.pcpDetails();
    if (!pd) return null;
    const now = Date.now();
    const start = pd['dateStarted'] ? new Date(pd['dateStarted']).getTime() : null;
    const end   = pd['dateCompleted'] ? new Date(pd['dateCompleted']).getTime() : null;
    if (start !== null && now < start) return 'pending';
    if (end !== null && now > end) return 'closed';
    return 'open';
  });

  /** Description with Typesense highlight markup when available, raw HTML otherwise. */
  readonly safeDescription = computed(() => {
    const raw = highlightField(this.rowData(), 'description');
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  });

  hl(field: string): string {
    return highlightField(this.rowData(), field);
  }

  authorName(id: string | null | undefined): string {
    if (!id) return '';
    return this.utils.idToListName(id, this.configService.listItems);
  }
}

