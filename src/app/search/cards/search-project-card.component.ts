import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { highlightField } from '../search-collections';

@Component({
  selector: 'app-search-project-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <article class="card search-result-card search-result-card--styled">
      <div class="search-card-header">
        <h5 class="fw-bold mb-0">{{ hit()['name'] || 'Unnamed Project' }}</h5>
      </div>
      <hr class="search-card-divider">
      <div class="search-card-content">
        <div class="d-flex flex-column flex-md-row gap-3">
          <div class="flex-fill align-self-md-start">
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
          <div class="search-card-vr d-none d-md-block"></div>
          <div class="d-flex flex-md-column align-items-md-stretch justify-content-md-center gap-2 flex-shrink-0">
            <a class="search-card-btn search-card-btn--primary"
              [routerLink]="['/p', hit()['id'] ?? hit()['objectID'], 'project-details']"
              (click)="clicked.emit()">
              <i class="material-icons">open_in_new</i><span>Project Page</span>
            </a>
          </div>
        </div>
        @if (safeDescription()) {
          <hr class="my-2 opacity-25">
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
