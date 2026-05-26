import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { highlightField } from '../search-collections';

@Component({
  selector: 'app-search-document-chunk-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="card search-result-card search-result-card--styled">
      <div class="search-card-header">
        <div class="d-flex align-items-start gap-2">
          <h5 class="fw-bold mb-0 flex-fill" [innerHTML]="docName()"></h5>
          @if (hit()['pageNumber']) {
            <span class="search-doc-ext-badge">p.{{ hit()['pageNumber'] }}</span>
          }
        </div>
      </div>
      <div class="search-card-content">
        <div class="d-flex flex-column flex-md-row gap-3">
          <div class="flex-fill">
            <div class="row row-cols-2 row-cols-md-3 g-2 mb-2">
              <div class="col">
                <div class="search-result-card-label">Project</div>
                <div class="search-result-card-value">{{ hit()['projectName'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Type</div>
                <div class="search-result-card-value">{{ hit()['documentType'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Milestone</div>
                <div class="search-result-card-value">{{ hit()['milestone'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Date Posted</div>
                <div class="search-result-card-value">
                  @if (hit()['datePosted']) {
                    {{ hit()['datePosted'] * 1000 | date:'yyyy-MM-dd' }}
                  } @else {
                    —
                  }
                </div>
              </div>
            </div>
            @if (hasContentMatch()) {
              <div class="search-result-content" [innerHTML]="snippet()"></div>
            }
          </div>
          <div class="search-card-vr d-none d-md-block"></div>
          <div class="card-actions">
            @if (hit()['projectId']) {
              <a class="search-card-btn search-card-btn--primary"
                [href]="'/p/' + hit()['projectId']"
                (click)="projectClicked.emit(); $event.stopPropagation()">
                <i class="material-icons">open_in_new</i><span>Project Page</span>
              </a>
            }
            @if (hit()['documentId']) {
              <a class="search-card-btn search-card-btn--primary"
                [href]="'/api/document/' + hit()['documentId'] + '/fetch' + pageFragment()"
                target="_blank"
                rel="noopener noreferrer"
                (click)="documentClicked.emit(); $event.stopPropagation()">
                <i class="material-icons">picture_as_pdf</i><span>View Page</span>
              </a>
            }
          </div>
        </div>
      </div>
    </article>
  `,
})
export class SearchDocumentChunkCardComponent {
  hit = input.required<any>();
  documentClicked = output<void>();
  projectClicked = output<void>();

  // highlightField() → sanitizeHighlight() output — safe for [innerHTML]
  docName = computed(() => highlightField(this.hit(), 'documentName') || 'Untitled Document');
  snippet = computed(() => highlightField(this.hit(), 'content'));

  /** True when the query matched inside the PDF content (vs. metadata fields only). */
  hasContentMatch = computed(() => {
    const hl = this.hit()['_highlightResult']?.['content']?.value;
    return !!hl && hl.includes('<mark>');
  });

  pageFragment = (): string => {
    const p = this.hit()['pageNumber'];
    return p ? `#page=${p}` : '';
  };
}
