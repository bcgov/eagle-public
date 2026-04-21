import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { highlightField } from '../search-collections';

@Component({
  selector: 'app-search-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card search-result-card">
      <div class="card-body p-4">
        <div class="d-flex flex-column flex-md-row gap-3">
          <div class="flex-fill">
            <h5 class="fw-bold mb-3">{{ hit()['name'] || 'Unnamed Project' }}</h5>
            <div class="row row-cols-2 row-cols-md-5 g-2">
              @if (hit()['proponent']) {
                <div class="col">
                  <div class="search-result-card-label">Proponent</div>
                  <div class="search-result-card-value">{{ hit()['proponent'] }}</div>
                </div>
              }
              @if (hit()['type']) {
                <div class="col">
                  <div class="search-result-card-label">Type</div>
                  <div class="search-result-card-value">{{ hit()['type'] }}</div>
                </div>
              }
              @if (hit()['region']) {
                <div class="col">
                  <div class="search-result-card-label">Region</div>
                  <div class="search-result-card-value">{{ hit()['region'] }}</div>
                </div>
              }
              @if (hit()['currentPhaseName']) {
                <div class="col">
                  <div class="search-result-card-label">Phase</div>
                  <div class="search-result-card-value">{{ hit()['currentPhaseName'] }}</div>
                </div>
              }
              @if (hit()['eacDecision']) {
                <div class="col">
                  <div class="search-result-card-label">Decision</div>
                  <div class="search-result-card-value">{{ hit()['eacDecision'] }}</div>
                </div>
              }
            </div>
          </div>
          <div class="search-result-action">
            <a
              class="search-dl-btn"
              [href]="'/p/' + (hit()['id'] ?? hit()['objectID']) + '/project-details'"
              (click)="clicked.emit(); $event.stopPropagation()"
            >Go to Project</a>
          </div>
        </div>
        @if (safeDescription()) {
          <hr class="my-3">
          <div class="search-result-content" [innerHTML]="safeDescription()"></div>
        }
      </div>
    </article>
  `,
})
export class SearchProjectCardComponent {
  hit = input.required<any>();
  clicked = output<void>();

  private sanitizer = inject(DomSanitizer);

  safeDescription = computed<SafeHtml | null>(() => {
    const raw = highlightField(this.hit(), 'description');
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  });
}
