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
  selector: 'app-search-document-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="card search-result-card search-result-card--styled">
      <div class="search-card-header">
        <div class="d-flex align-items-start gap-2">
          <h5 class="fw-bold mb-0 flex-fill" [innerHTML]="name()"></h5>
          @if (hit()['internalExt']) {
            <span class="search-doc-ext-badge">{{ hit()['internalExt'].toUpperCase() }}</span>
          }
        </div>
      </div>
      <div class="search-card-content">
        <div class="d-flex flex-column flex-md-row gap-3">
          <div class="flex-fill">
            <div class="row row-cols-2 row-cols-md-4 g-2">
              <div class="col">
                <div class="search-result-card-label">Project</div>
                <div class="search-result-card-value">{{ hit()['projectName'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Type</div>
                <div class="search-result-card-value">{{ hit()['type'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Milestone</div>
                <div class="search-result-card-value">{{ hit()['milestone'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Author Type</div>
                <div class="search-result-card-value">{{ hit()['documentAuthorType'] || '—' }}</div>
              </div>
              <div class="col">
                <div class="search-result-card-label">Phase</div>
                <div class="search-result-card-value">{{ hit()['projectPhase'] || '—' }}</div>
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
          </div>
          <div class="search-card-vr d-none d-md-block"></div>
          <div class="card-actions">
            @if (hit()['projectId'] && showProjectLink()) {
              <a class="search-card-btn search-card-btn--primary"
                [href]="'/p/' + hit()['projectId']"
                (click)="projectClicked.emit(); $event.stopPropagation()">
                <i class="material-icons">open_in_new</i><span>Project Page</span>
              </a>
            }
            <a class="search-card-btn search-card-btn--primary"
              [href]="'/api/document/' + (hit()['id'] ?? hit()['objectID']) + '/fetch'"
              target="_blank"
              rel="noopener noreferrer"
              (click)="downloadClicked.emit(); $event.stopPropagation()">
              <i class="material-icons">file_download</i><span>Download</span>
            </a>
          </div>
        </div>
        @if (hit()['documentFileName'] && hit()['documentFileName'] !== hit()['displayName']) {
          <hr class="opacity-25">
          <div class="search-result-content text-muted">{{ hit()['documentFileName'] }}</div>
        }
      </div>
    </article>
  `,
})
export class SearchDocumentCardComponent {
  hit = input.required<any>();
  showProjectLink = input(true);
  downloadClicked = output<void>();
  projectClicked = output<void>();

  // highlightField() → sanitizeHighlight() output — safe for [innerHTML]
  name = computed(() =>
    highlightField(this.hit(), 'displayName')
    || highlightField(this.hit(), 'documentFileName')
    || 'Untitled Document'
  );
}
