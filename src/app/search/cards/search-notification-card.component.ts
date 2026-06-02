import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { ApiService } from '../../services/api';
import { ConfigService } from '../../services/config.service';
import { highlightField } from '../search-collections';
import { sanitizeHighlight } from 'app/search/highlight/sanitize-highlight';

@Component({
  selector: 'app-search-notification-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  styles: [`
    .pcp-status {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 0.75rem; font-weight: 600;
      padding: 0.15rem 0.55rem; border-radius: 999px;
    }
    .pcp-status::before {
      content: ''; display: inline-block;
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .pcp-status--open    { background: rgba(46,133,64,.12); color: #2e8540; }
    .pcp-status--open::before    { background: #2e8540; }
    .pcp-status--pending { background: rgba(252,186,25,.15); color: #9a6c00; }
    .pcp-status--pending::before { background: #fcba19; }
    .pcp-status--closed  { background: rgba(216,41,47,.10); color: #d8292f; }
    .pcp-status--closed::before  { background: #d8292f; }
  `],
  template: `
    <article class="card search-result-card search-result-card--styled">
      <div class="search-card-header">
        <h5 class="fw-bold mb-0" [innerHTML]="hl('name') || 'Untitled'"></h5>
      </div>
      @if (engageLink()) {
        <div class="d-flex align-items-center gap-2 flex-wrap px-3 py-2 bg-success-subtle border-bottom border-success-subtle small">
          <i class="material-icons" style="font-size:1.1em;color:var(--bs-success)">forum</i>
          <span class="fw-semibold">Comment Period:</span>
          <span class="pcp-status pcp-status--{{ hit()['pcp'] }}">{{ hit()['pcp'] | titlecase }}</span>
          <a class="btn btn-sm btn-success ms-auto"
             [href]="engageLink()" target="_blank" rel="noopener noreferrer"
             (click)="$event.stopPropagation()">
            View Engagement
          </a>
        </div>
      }
      <div class="search-card-content">
        <div class="d-flex flex-column flex-md-row gap-3">
          <div class="flex-fill">
            <div class="row row-cols-2 row-cols-md-3 g-2">
              @if (hit()['type']) {
                <div class="col">
                  <div class="search-result-card-label">Type</div>
                  <div class="search-result-card-value">{{ hit()['type'] }}</div>
                </div>
              }
              @if (hit()['subType']) {
                <div class="col">
                  <div class="search-result-card-label">Sub-Type</div>
                  <div class="search-result-card-value" [innerHTML]="hl('subType')"></div>
                </div>
              }
              @if (hit()['proponent']) {
                <div class="col">
                  <div class="search-result-card-label">Proponent</div>
                  <div class="search-result-card-value" [innerHTML]="hl('proponent')"></div>
                </div>
              }
              @if (hit()['region']) {
                <div class="col">
                  <div class="search-result-card-label">Region</div>
                  <div class="search-result-card-value" [innerHTML]="hl('region')"></div>
                </div>
              }
              @if (hit()['location']) {
                <div class="col">
                  <div class="search-result-card-label">Location</div>
                  <div class="search-result-card-value" [innerHTML]="hl('location')"></div>
                </div>
              }
              @if (hit()['trigger']) {
                <div class="col">
                  <div class="search-result-card-label">Notification Trigger</div>
                  <div class="search-result-card-value">{{ hit()['trigger'] }}</div>
                </div>
              }
              @if (hit()['decision']) {
                <div class="col">
                  <div class="search-result-card-label">Decision</div>
                  <div class="search-result-card-value">{{ hit()['decision'] }}</div>
                </div>
              }
              @if (hit()['pcp'] && !engageLink()) {
                <div class="col">
                  <div class="search-result-card-label">Comment Period</div>
                  <div class="search-result-card-value">
                    <span class="pcp-status pcp-status--{{ hit()['pcp'] }}">{{ hit()['pcp'] | titlecase }}</span>
                  </div>
                </div>
              }
              @if (hit()['notificationReceivedDate']) {
                <div class="col">
                  <div class="search-result-card-label">Date Received</div>
                  <div class="search-result-card-value">
                    {{ hit()['notificationReceivedDate'] * 1000 | date:'yyyy-MM-dd' }}
                  </div>
                </div>
              }
              @if (hit()['associatedProjectName']) {
                <div class="col">
                  <div class="search-result-card-label">Project</div>
                  <div class="search-result-card-value" [innerHTML]="hl('associatedProjectName')"></div>
                </div>
              }
            </div>
          </div>
          <div class="search-card-vr d-none d-md-block"></div>
          <div class="card-actions">
            @if (hit()['associatedProjectId']) {
              <a class="search-card-btn search-card-btn--primary"
                [href]="'/p/' + hit()['associatedProjectId']"
                (click)="projectClicked.emit(); $event.stopPropagation()">
                <i class="material-icons">open_in_new</i><span>Project Page</span>
              </a>
            }
            <button type="button" class="search-card-btn search-card-btn--primary" (click)="toggleDocs()">
              <i class="material-icons">description</i><span>{{ expanded() ? 'Hide Documents' : 'Documents' }}</span>
            </button>
          </div>
        </div>

        @if (safeDescription()) {
          <hr class="opacity-25">
          <div class="search-result-content" [innerHTML]="safeDescription()"></div>
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
    </article>
  `,
})
export class SearchNotificationCardComponent {
  hit = input.required<any>();
  projectClicked = output<void>();

  private sanitizer = inject(DomSanitizer);
  private api = inject(ApiService);
  private configService = inject(ConfigService);
  private lists = toSignal(this.configService.lists, { initialValue: [] as any[] });

  /** Returns Typesense highlight snippet for `field`, falling back to the raw hit value. */
  hl(field: string): string {
    return highlightField(this.hit(), field);
  }

  resolveAuthor(id: string | null | undefined): string {
    if (!id) return '-';
    const item = this.lists().find((l: any) => l._id === id);
    return item ? item.name : '-';
  }

  expanded = signal(false);
  documents = signal<any[] | null>(null);
  docsLoading = signal(false);

  /** Direct Engage engagement URL — present when `isMet=true` and `metURL` is set on this PN. */
  engageLink = computed((): string | null => {
    const h = this.hit();
    return (h['isMet'] && h['metURL']) ? h['metURL'] : null;
  });

  toggleDocs(): void {
    this.expanded.update(v => !v);
    if (this.expanded() && this.documents() === null) {
      const id = this.hit()['id'] ?? this.hit()['objectID'];
      if (!id) return;
      this.docsLoading.set(true);
      this.api.getDocumentsByNotificationId(id).subscribe({
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

  safeDescription = computed(() => {
    const h = this.hit();
    const raw = h['_highlightResult']?.['description']?.value
      ? sanitizeHighlight(h['_highlightResult']['description'].value)
      : (h['descriptionHtml'] ?? h['description']);
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  });
}
