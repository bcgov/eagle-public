import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api';
import { ConfigService } from '../../services/config.service';
import { resolveDocUrl } from 'app/search/search-collections';

@Component({
  selector: 'app-search-activity-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="card search-result-card">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-md-row gap-3 align-items-md-stretch">
          <div class="d-flex flex-column gap-2 flex-fill">
            <div class="d-flex align-items-start gap-2 flex-wrap">
              <h5 class="fw-bold mb-0"
                [innerHTML]="hit()['_highlightResult']?.['headline']?.value ?? hit()['headline'] ?? hit()['notificationName'] ?? 'Untitled'">
              </h5>
              @if (isNotificationType()) {
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle activity-notif-badge">
                  Notification
                </span>
              }
            </div>
            <div class="row row-cols-2 row-cols-md-4 g-2">
              @if (hit()['projectName']) {
                <div class="col">
                  <div class="search-result-card-label">Project</div>
                  <div class="search-result-card-value">{{ hit()['projectName'] }}</div>
                </div>
              }
              @if (hit()['type']) {
                <div class="col">
                  <div class="search-result-card-label">Type</div>
                  <div class="search-result-card-value">{{ hit()['type'] }}</div>
                </div>
              }
              @if (hit()['dateAdded']) {
                <div class="col">
                  <div class="search-result-card-label">Date</div>
                  <div class="search-result-card-value">
                    {{ hit()['dateAdded'] * 1000 | date:'yyyy-MM-dd' }}
                  </div>
                </div>
              }
            </div>
          </div>
          @if (hit()['projectId'] || hasDocSource() || docLink()) {
            <div class="vr d-none d-md-block"></div>
            <div class="d-flex flex-md-column align-items-md-stretch justify-content-md-center gap-2">
              @if (hit()['projectId']) {
                <a class="search-dl-btn search-dl-btn--block"
                  [href]="'/p/' + hit()['projectId']"
                  (click)="projectClicked.emit(); $event.stopPropagation()">
                  Go to Project
                </a>
              }
              @if (hasDocSource()) {
                <button type="button" class="search-dl-btn search-dl-btn--block flex-shrink-0" (click)="toggleDocs()">
                  {{ expanded() ? 'Hide Documents' : 'View Documents' }}
                </button>
              } @else if (docLink()) {
                <a class="search-dl-btn search-dl-btn--block"
                  [href]="docLink()"
                  (click)="$event.stopPropagation()">
                  View Documents
                </a>
              }
            </div>
          }
        </div>

        @if (safeContent()) {
          <hr class="my-3">
          <div class="search-result-content" [innerHTML]="safeContent()"></div>
        }

        @if (expanded()) {
          <hr class="my-3">
          <div>
            @if (docsLoading()) {
              <div class="d-flex align-items-center gap-2 text-muted small py-2">
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Loading documents&hellip;
              </div>
            } @else if (documents()?.length === 0) {
              <p class="text-muted small mb-0">No documents available.</p>
            } @else {
              <!-- Header row — desktop only -->
              <div class="d-none d-md-flex gap-3 px-2 py-1 small fw-semibold rounded-1 mb-2 search-doc-header">
                <span class="flex-fill">Document Name</span>
                <span class="search-doc-date">Date Posted</span>
                <span class="search-doc-author">Author</span>
                <span class="search-doc-action"></span>
              </div>
              @for (doc of documents(); track doc['_id']) {
                <div class="d-flex flex-column flex-md-row align-items-md-center gap-1 gap-md-3 py-2 border-bottom search-doc-row">
                  <span class="flex-fill fw-semibold small search-doc-name">
                    {{ doc['displayName'] || doc['documentFileName'] || 'Untitled' }}
                  </span>
                  <span class="text-muted small d-none d-md-block search-doc-date">
                    {{ doc['datePosted'] ? (doc['datePosted'] | date:'yyyy-MM-dd') : '' }}
                  </span>
                  <span class="text-muted small d-none d-md-block text-truncate search-doc-author"
                    [title]="resolveAuthor(doc['documentAuthor'])">
                    {{ resolveAuthor(doc['documentAuthor']) }}
                  </span>
                  <!-- mobile: compact date + author -->
                  <div class="d-flex d-md-none gap-2 text-muted search-doc-mobile-row">
                    @if (doc['datePosted']) {
                      <span>{{ doc['datePosted'] | date:'yyyy-MM-dd' }}</span>
                    }
                    @if (doc['documentAuthor']) {
                      <span class="text-truncate">{{ resolveAuthor(doc['documentAuthor']) }}</span>
                    }
                  </div>
                  <a class="d-flex align-items-center justify-content-center text-primary search-doc-action"
                    [href]="'/api/document/' + doc['_id'] + '/fetch'"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download">
                    <i class="material-icons md-18">file_download</i>
                  </a>
                </div>
              }
            }
          </div>
        }
      </div>
    </article>
  `,
  styles: [`.activity-notif-badge { font-size: 0.65rem; padding: 0.2em 0.55em; flex-shrink: 0; }`],
})
export class SearchActivityCardComponent {
  hit = input.required<any>();
  projectClicked = output<void>();

  private sanitizer = inject(DomSanitizer);
  private api = inject(ApiService);
  private configService = inject(ConfigService);
  private lists = toSignal(this.configService.lists, { initialValue: [] as any[] });

  isNotificationType = computed(() => {
    const t = this.hit()['type'] ?? '';
    return t === 'Project Notification News' || t === 'Project Notification Public Comment Period';
  });

  /**
   * True when we can fetch an actual document list (notification ref or PCP ref present).
   * When false, fall back to the external documentUrl link (or nothing).
   */
  hasDocSource = computed(() =>
    !!(this.hit()['projectNotificationId'] || this.hit()['pcpId'])
  );

  /** Resolved documentUrl — rewrites legacy project-notifications URLs to unified search. */
  docLink = computed((): string | null => {
    const url = this.hit()['documentUrl'];
    return url ? resolveDocUrl(url) : null;
  });

  safeContent = computed(() => {
    const h = this.hit();
    const raw = h['_highlightResult']?.['content']?.value ?? h['contentHtml'] ?? h['content'];
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  });

  resolveAuthor(id: string | null | undefined): string {
    if (!id) return '-';
    const item = this.lists().find((l: any) => l._id === id);
    return item ? item.name : '-';
  }

  expanded = signal(false);
  documents = signal<any[] | null>(null);
  docsLoading = signal(false);

  toggleDocs(): void {
    this.expanded.update(v => !v);
    if (this.expanded() && this.documents() === null) {
      this.docsLoading.set(true);
      const h = this.hit();
      const notifId = h['projectNotificationId'];
      const pcpId   = h['pcpId'];
      const obs = notifId
        ? this.api.getDocumentsByNotificationId(notifId)
        : this.api.getDocumentsByPcpId(pcpId);
      obs.subscribe({
        next: (docs: any[]) => {
          this.documents.set(docs ?? []);
          this.docsLoading.set(false);
        },
        error: () => {
          this.documents.set([]);
          this.docsLoading.set(false);
        },
      });
    }
  }
}

