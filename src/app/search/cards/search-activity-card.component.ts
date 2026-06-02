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
import { resolveDocUrl, highlightField } from 'app/search/search-collections';
import { sanitizeHighlight, escapeHtml } from 'app/search/highlight/sanitize-highlight';
import { sanitizeWordHtml } from 'app/shared/utils/word-html-sanitizer';

@Component({
  selector: 'app-search-activity-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="card search-result-card search-result-card--styled">
      <div class="search-card-header">
        <div class="d-flex align-items-start gap-2 flex-wrap">
          <h5 class="fw-bold mb-0 flex-fill"
            [innerHTML]="hl('headline') || hit()['notificationName'] || 'Untitled'">
          </h5>
          @if (activityBadge(); as badge) {
            <span class="badge flex-shrink-0" [class]="badge.cls">
              {{ badge.label }}
            </span>
          }
        </div>
      </div>

      @if (hit()['projectName'] || hit()['type'] || hit()['dateAdded'] || hit()['notificationName'] || hit()['complianceAndEnforcement'] || safeContent() || expanded() || (hit()['projectId'] && showProjectLink()) || hasDocSource() || pcpDocsLink() || docLink()) {
        <div class="search-card-content">
          <div class="d-flex flex-column flex-md-row gap-3">
            <div class="flex-fill">
              <div class="row row-cols-2 row-cols-md-4 g-2">
                @if (hit()['projectName']) {
                  <div class="col">
                    <div class="search-result-card-label">Project</div>
                    <div class="search-result-card-value" [innerHTML]="hl('projectName')"></div>
                  </div>
                }
                @if (hit()['type']) {
                  <div class="col">
                    <div class="search-result-card-label">Type</div>
                    <div class="search-result-card-value" [innerHTML]="hl('type')"></div>
                  </div>
                }
                @if (hit()['dateAdded']) {
                  <div class="col">
                    <div class="search-result-card-label">Date</div>
                    <div class="search-result-card-value">{{ hit()['dateAdded'] * 1000 | date:'MMM d, y' }}</div>
                  </div>
                }
                @if (hit()['notificationName']) {
                  <div class="col">
                    <div class="search-result-card-label">Notification</div>
                    <div class="search-result-card-value" [innerHTML]="hl('notificationName')"></div>
                  </div>
                }
                @if (hit()['complianceAndEnforcement']) {
                  <div class="col">
                    <div class="search-result-card-label">Category</div>
                    <div class="search-result-card-value">Compliance &amp; Enforcement</div>
                  </div>
                }
                @if (hit()['pinned']) {
                  <div class="col">
                    <div class="search-result-card-label">Status</div>
                    <div class="search-result-card-value">Pinned</div>
                  </div>
                }
              </div>
            </div>
              @if ((hit()['projectId'] && showProjectLink()) || hasDocSource() || pcpDocsLink() || docLink() || engageLink()) {
              <div class="search-card-vr d-none d-md-block"></div>
              <div class="card-actions">
                @if (hit()['projectId'] && showProjectLink()) {
                  <a class="search-card-btn search-card-btn--primary"
                    [href]="'/p/' + hit()['projectId']"
                    (click)="projectClicked.emit(); $event.stopPropagation()">
                    <i class="material-icons">open_in_new</i><span>Project Page</span>
                  </a>
                }
                @if (engageLink()) {
                  <a class="search-card-btn search-card-btn--primary"
                    [href]="engageLink()"
                    target="_blank"
                    rel="noopener noreferrer"
                    (click)="$event.stopPropagation()">
                    <i class="material-icons">forum</i><span>View Engagement</span>
                  </a>
                }
                @if (hasDocSource()) {
                  <button type="button" class="search-card-btn search-card-btn--primary" (click)="toggleDocs()">
                    <i class="material-icons">description</i><span>{{ expanded() ? 'Hide Documents' : 'Documents' }}</span>
                  </button>
                } @else if (pcpDocsLink()) {
                  <a class="search-card-btn search-card-btn--primary"
                    [href]="pcpDocsLink()"
                    (click)="$event.stopPropagation()">
                    <i class="material-icons">description</i><span>Documents</span>
                  </a>
                } @else if (docLink()) {
                  <a class="search-card-btn search-card-btn--primary"
                    [href]="docLink()"
                    target="_blank"
                    rel="noopener noreferrer"
                    (click)="$event.stopPropagation()">
                    <i class="material-icons">description</i><span>Documents</span>
                  </a>
                }
              </div>
            }
          </div>
          @if (safeContent()) {
            <hr class="opacity-25">
            <div class="search-result-content" [class.mb-3]="expanded()" [innerHTML]="safeContent()"></div>
          }
          @if (expanded()) {
            <div class="mt-2">
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
      }
    </article>
  `,
  styles: [`
    .activity-badge--news  { font-size: 0.65rem; padding: 0.2em 0.55em; background-color: rgba(103, 232, 249, 0.15); color: #67e8f9; border: 1px solid rgba(103, 232, 249, 0.5); }
    .activity-badge--pcp   { font-size: 0.65rem; padding: 0.2em 0.55em; background-color: rgba(134, 239, 172, 0.15); color: #86efac; border: 1px solid rgba(134, 239, 172, 0.5); }
    .activity-badge--notif { font-size: 0.65rem; padding: 0.2em 0.55em; background-color: rgba(252, 186, 25, 0.2);   color: #fcba19; border: 1px solid rgba(252, 186, 25, 0.6); }
  `],
})
export class SearchActivityCardComponent {
  hit = input.required<any>();
  showProjectLink = input(true);
  projectClicked = output<void>();

  private sanitizer = inject(DomSanitizer);
  private api = inject(ApiService);
  private configService = inject(ConfigService);
  private lists = toSignal(this.configService.lists, { initialValue: [] as any[] });

  activityBadge = computed((): { label: string; cls: string } | null => {
    switch (this.hit()['type']) {
      case 'News': return { label: 'News', cls: 'activity-badge--news' };
      case 'Public Comment Period': return { label: 'Comment Period', cls: 'activity-badge--pcp' };
      case 'Project Notification News':
      case 'Project Notification Public Comment Period':
        return { label: 'Notification', cls: 'activity-badge--notif' };
      default: return null;
    }
  });

  /**
   * True when we can fetch an actual document list (notification ref present).
   * PCP types link to the project documents tab instead.
   */
  hasDocSource = computed(() =>
    !!this.hit()['projectNotificationId']
  );

  /** For PCP hits: link directly to the project documents tab. */
  pcpDocsLink = computed((): string | null => {
    const h = this.hit();
    if (!h['pcpId']) return null;
    const projectId = h['projectId'];
    return projectId ? `/p/${projectId}/documents` : null;
  });

  /** Resolved documentUrl — rewrites legacy project-notifications URLs to unified search. */
  docLink = computed((): string | null => {
    const url = this.hit()['documentUrl'];
    return url ? resolveDocUrl(url) : null;
  });

  /** For Engage-managed PCP hits: direct link to the Engage engagement page. */
  engageLink = computed((): string | null => {
    const h = this.hit();
    return (h['pcpIsMet'] && h['pcpMetURL']) ? h['pcpMetURL'] : null;
  });

  hl(field: string): string {
    return highlightField(this.hit(), field);
  }

  safeContent = computed(() => {
    const h = this.hit();
    const rawHighlight = h['_highlightResult']?.['content']?.value;

    if (rawHighlight) {
      // sanitizeHighlight: strips dangerous HTML, preserves <mark>, decodes entities
      const sanitized = sanitizeHighlight(rawHighlight);
      return this.sanitizer.bypassSecurityTrustHtml(this.linkifyUrls(sanitized));
    }

    const htmlContent = h['contentHtml'];
    if (htmlContent) {
      return this.sanitizer.bypassSecurityTrustHtml(sanitizeWordHtml(htmlContent));
    }

    const plain = h['content'];
    if (!plain) return null;
    // Plain text — escape to prevent XSS, then linkify
    return this.sanitizer.bypassSecurityTrustHtml(this.linkifyUrls(escapeHtml(String(plain))));
  });

  private linkifyUrls(text: string): string {
    return text.replace(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g, (url) => {
      const clean = url.replace(/[.,;:!?)'"\u201C\u201D]+$/, '');
      const trailing = url.slice(clean.length);
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${trailing}`;
    });
  }

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
      const notifId = this.hit()['projectNotificationId'];
      this.api.getDocumentsByNotificationId(notifId).subscribe({
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

