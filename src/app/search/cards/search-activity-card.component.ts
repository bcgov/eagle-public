import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
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
          @if (hit()['projectId'] || docLink()) {
            <div class="vr d-none d-md-block"></div>
            <div class="d-flex flex-md-column align-items-md-stretch justify-content-md-center gap-2">
              @if (hit()['projectId']) {
                <a class="search-dl-btn search-dl-btn--block"
                  [href]="'/p/' + hit()['projectId']"
                  (click)="projectClicked.emit(); $event.stopPropagation()">
                  Go to Project
                </a>
              }
              @if (docLink()) {
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
      </div>
    </article>
  `,
  styles: [`.activity-notif-badge { font-size: 0.65rem; padding: 0.2em 0.55em; flex-shrink: 0; }`],
})
export class SearchActivityCardComponent {
  hit = input.required<any>();
  projectClicked = output<void>();

  private sanitizer = inject(DomSanitizer);

  isNotificationType = computed(() => {
    const t = this.hit()['type'] ?? '';
    return t === 'Project Notification News' || t === 'Project Notification Public Comment Period';
  });

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
}

