import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-search-document-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="card search-result-card">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-md-row gap-3">
          <div class="flex-fill">
            <div class="d-flex flex-column gap-2">
              <h5 class="fw-bold mb-0">
                {{ hit()['displayName'] || hit()['documentFileName'] || 'Untitled Document' }}
              </h5>
              @if (hit()['documentFileName'] && hit()['documentFileName'] !== hit()['displayName']) {
                <div class="text-muted small">{{ hit()['documentFileName'] }}</div>
              }
              <div class="row row-cols-2 row-cols-md-4 g-2 mt-1">
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
                @if (hit()['milestone']) {
                  <div class="col">
                    <div class="search-result-card-label">Milestone</div>
                    <div class="search-result-card-value">{{ hit()['milestone'] }}</div>
                  </div>
                }
                @if (hit()['datePosted']) {
                  <div class="col">
                    <div class="search-result-card-label">Date Posted</div>
                    <div class="search-result-card-value">
                      {{ hit()['datePosted'] * 1000 | date:'yyyy-MM-dd' }}
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
          <div class="search-result-action">
            @if (hit()['projectId']) {
              <a
                class="search-dl-btn"
                [href]="'/p/' + hit()['projectId']"
                (click)="projectClicked.emit(); $event.stopPropagation()"
              >Go to Project</a>
            }
            <a
              class="search-dl-btn mt-2"
              [href]="'/api/document/' + (hit()['id'] ?? hit()['objectID']) + '/fetch'"
              target="_blank"
              rel="noopener noreferrer"
              (click)="downloadClicked.emit(); $event.stopPropagation()"
            >Download</a>
          </div>
        </div>
      </div>
    </article>
  `,
})
export class SearchDocumentCardComponent {
  hit = input.required<any>();
  downloadClicked = output<void>();
  projectClicked = output<void>();
}
