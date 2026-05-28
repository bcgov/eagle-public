import { Component, ChangeDetectionStrategy, inject, signal, output } from '@angular/core';
import { Subject } from 'rxjs';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';
import { highlightField } from 'app/search/search-collections';

@Component({
  selector: 'tr[app-search-notification-table-rows]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe],
  template: `
    <td class="col-12 notif-card-cell">
      <div class="notif-card-body">
          <div class="d-flex flex-column flex-md-row gap-3 align-items-md-stretch">
            <div class="d-flex flex-column gap-2 flex-fill">
              <h5 class="fw-bold mb-0" [innerHTML]="hl('name') || 'Untitled'"></h5>
              <div class="row row-cols-2 row-cols-md-3 g-2">
                @if (rowData.type) {
                  <div class="col">
                    <div class="search-result-card-label">Type</div>
                    <div class="search-result-card-value">{{ rowData.type }}</div>
                  </div>
                }
                @if (rowData.subType) {
                  <div class="col">
                    <div class="search-result-card-label">Sub-Type</div>
                    <div class="search-result-card-value" [innerHTML]="hl('subType')"></div>
                  </div>
                }
                @if (rowData.proponent) {
                  <div class="col">
                    <div class="search-result-card-label">Proponent</div>
                    <div class="search-result-card-value" [innerHTML]="hl('proponent')"></div>
                  </div>
                }
                @if (rowData.region) {
                  <div class="col">
                    <div class="search-result-card-label">Region</div>
                    <div class="search-result-card-value" [innerHTML]="hl('region')"></div>
                  </div>
                }
                @if (rowData.location) {
                  <div class="col">
                    <div class="search-result-card-label">Location</div>
                    <div class="search-result-card-value" [innerHTML]="hl('location')"></div>
                  </div>
                }
                @if (rowData.trigger) {
                  <div class="col">
                    <div class="search-result-card-label">Notification Trigger</div>
                    <div class="search-result-card-value">{{ rowData.trigger }}</div>
                  </div>
                }
                @if (rowData.decision) {
                  <div class="col">
                    <div class="search-result-card-label">Decision</div>
                    <div class="search-result-card-value">{{ rowData.decision }}</div>
                  </div>
                }
                @if (rowData.pcp) {
                  <div class="col">
                    <div class="search-result-card-label">Comment Period</div>
                    <div class="search-result-card-value">{{ rowData.pcp | titlecase }}</div>
                  </div>
                }
                @if (rowData._receivedDate) {
                  <div class="col">
                    <div class="search-result-card-label">Date Received</div>
                    <div class="search-result-card-value">
                      {{ rowData._receivedDate | date:'yyyy-MM-dd' }}
                    </div>
                  </div>
                }
                @if (rowData.associatedProjectName) {
                  <div class="col">
                    <div class="search-result-card-label">Project</div>
                    <div class="search-result-card-value" [innerHTML]="hl('associatedProjectName')"></div>
                  </div>
                }
              </div>
            </div>
            <div class="vr d-none d-md-block"></div>
            <div class="d-flex flex-md-column align-items-md-stretch justify-content-md-center gap-2">
              @if (rowData.associatedProjectId) {
                <a class="search-dl-btn search-dl-btn--block flex-shrink-0"
                  [href]="'/p/' + rowData.associatedProjectId">
                  Go to Project
                </a>
              }
              <button type="button" class="search-dl-btn search-dl-btn--block flex-shrink-0"
                (click)="toggleDocs()">
                {{ expanded() ? 'Hide Documents' : 'View Documents' }}
              </button>
            </div>
          </div>

          @if (safeDescription()) {
            <hr class="my-3">
            <div class="search-result-content" [innerHTML]="safeDescription()"></div>
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
                <div class="d-none d-md-flex gap-3 px-2 py-1 small fw-semibold rounded-1 mb-2 notif-doc-header">
                  <span class="flex-fill">Document Name</span>
                  <span class="notif-doc-date">Date Posted</span>
                  <span class="notif-doc-author">Author</span>
                  <span class="notif-doc-action"></span>
                </div>
                @for (doc of documents(); track doc['_id']) {
                  <div class="d-flex flex-column flex-md-row align-items-md-center gap-1 gap-md-3 py-2 border-bottom notification-doc-row">
                    <span class="flex-fill fw-semibold small notification-doc-name">
                      {{ doc['displayName'] || doc['documentFileName'] || 'Untitled' }}
                    </span>
                    <span class="text-muted small d-none d-md-block notif-doc-date">
                      {{ doc['datePosted'] ? (doc['datePosted'] | date:'yyyy-MM-dd') : '' }}
                    </span>
                    <span class="text-muted small d-none d-md-block text-truncate notif-doc-author"
                      [title]="resolveAuthor(doc['documentAuthor'])">
                      {{ resolveAuthor(doc['documentAuthor']) }}
                    </span>
                    <div class="d-flex d-md-none gap-2 text-muted notif-doc-mobile-row">
                      @if (doc['datePosted']) {
                        <span>{{ doc['datePosted'] | date:'yyyy-MM-dd' }}</span>
                      }
                      @if (doc['documentAuthor']) {
                        <span class="text-truncate">{{ resolveAuthor(doc['documentAuthor']) }}</span>
                      }
                    </div>
                    <a class="d-flex align-items-center justify-content-center text-primary notif-doc-action"
                      [href]="'/api/document/' + doc['_id'] + '/fetch'"
                      target="_blank" rel="noopener noreferrer" title="Download">
                      <i class="material-icons md-18">file_download</i>
                    </a>
                  </div>
                }
              }
            </div>
          }
      </div>
    </td>
  `,
})
export class SearchNotificationTableRowsComponent implements TableRowComponent {
  rowData: any;
  tableData!: TableObject;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();

  private sanitizer = inject(DomSanitizer);
  private api = inject(ApiService);
  private configService = inject(ConfigService);
  private lists = toSignal(this.configService.lists, { initialValue: [] as any[] });

  expanded = signal(false);
  documents = signal<any[] | null>(null);
  docsLoading = signal(false);

  hl(field: string): string {
    return highlightField(this.rowData, field);
  }

  resolveAuthor(id: string | null | undefined): string {
    if (!id) return '-';
    const item = this.lists().find((l: any) => l._id === id);
    return item ? item.name : '-';
  }

  toggleDocs(): void {
    this.expanded.update(v => !v);
    if (this.expanded() && this.documents() === null) {
      const id = this.rowData._id;
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

  safeDescription(): any {
    const raw = this.rowData?._highlightResult?.['description']?.value
      ?? this.rowData?.description;
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  }
}
