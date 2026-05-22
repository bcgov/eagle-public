import {
  Component, ChangeDetectionStrategy, inject, input, computed,
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
          @if (rowData().pcp) {
            <div class="col">
              <div class="search-result-card-label">Comment Period</div>
              <div class="search-result-card-value">{{ rowData().pcp | titlecase }}</div>
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

        <!-- Action button -->
        @if (rowData().associatedProjectId) {
          <div class="d-flex flex-wrap gap-2 mt-3">
            <a class="btn btn-sm btn-outline-primary"
              [href]="'/p/' + rowData().associatedProjectId">
              View Project
            </a>
          </div>
        }

      </div>

      <!-- ── Documents ──────────────────────────────────────────────── -->
      @if (documents().length) {
        <div class="notif-doc-section px-3 pt-2 pb-1">

          <!-- Header row (desktop) -->
          <div class="d-none d-md-flex align-items-center gap-3 px-2 py-1 small fw-semibold notif-doc-header rounded-1 mb-1">
            <span class="flex-fill">Document Name</span>
            <span class="notif-doc-col-date">Date Posted</span>
            <span class="notif-doc-col-author">Author</span>
            <span class="notif-doc-col-action"></span>
          </div>

          @for (doc of documents(); track doc['_id']) {
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
              <!-- Mobile: compact date + author subtitle -->
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

        </div>
      }

    </article>
  `,
  styles: [`
    .notif-doc-section { background: var(--table-row-bg); border-top: 1px solid var(--bs-border-color, #dee2e6); }
    .notif-doc-header { background: var(--bs-secondary-bg, #e9ecef); color: var(--bs-secondary-color, #6c757d); }
    .notif-doc-row { border-bottom: 1px solid var(--bs-border-color, #dee2e6); font-size: .875rem; }
    .notif-doc-row:last-child { border-bottom: none; }
    .notif-doc-name { word-break: break-word; }
    .notif-doc-col-date   { width: 100px; flex-shrink: 0; white-space: nowrap; }
    .notif-doc-col-author { width: 160px; flex-shrink: 0; overflow: hidden; }
    .notif-doc-col-action { width: 38px; flex-shrink: 0; padding: 0.15rem 0.35rem; }
  `],
})
export class SearchNotificationCardComponent {
  rowData = input.required<any>();

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
    { initialValue: [] as any[] },
  );

  /** Description with Typesense highlight when available, full HTML otherwise. */
  readonly safeDescription = computed(() => {
    const rd = this.rowData();
    const highlight = rd?._highlightResult?.['description']?.value;
    if (highlight) return highlightField(rd, 'description');
    const raw = rd?.description;
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

