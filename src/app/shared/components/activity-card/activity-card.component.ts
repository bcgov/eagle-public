import { Component, EventEmitter, Input, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { sanitizeWordHtml } from 'app/shared/utils/word-html-sanitizer';
import { resolveDocUrl } from 'app/search/search-collections';

/**
 * Shared activity card component. Renders a single RecentActivity item in the
 * home page card style (project name → headline → date → content → buttons).
 *
 * Works in two contexts:
 *  - Table rows (lib-table-template): used as TableRowComponent. tableData is set by
 *    TableRowDirective; tableMode is true → renders two <td> cells with date in the
 *    second column. showProjectInfo is read from tableData.data.showProjectInfo.
 *  - Home page standalone: tableData is null → tableMode is false → renders single
 *    <td> with inline date. showProjectInfo uses the @Input binding directly.
 */
@Component({
  selector: 'tr[app-activity-card], app-activity-card-home',
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, DatePipe],
  host: {
    '[class.badge-type--news]':  "activityBadge()?.cls === 'activity-badge--news'",
    '[class.badge-type--pcp]':   "activityBadge()?.cls === 'activity-badge--pcp'",
    '[class.badge-type--notif]': "activityBadge()?.cls === 'activity-badge--notif'"
  }
})
export class ActivityCardComponent implements TableRowComponent {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private analytics = inject(AnalyticsService);

  // TableRowComponent interface — set by TableRowDirective in table context
  @Input() rowData: any = null;
  tableData: TableObject = null as any;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  /** Controls "Project Info" button visibility when used standalone (home page). */
  @Input() showProjectInfo = true;

  /**
   * True when rendered inside lib-table-template (tableData injected by TableRowDirective).
   * False on home page (tableData is null).
   */
  get tableMode(): boolean {
    return this.tableData != null;
  }

  /**
   * Effective showProjectInfo value. In table context, tableData.data.showProjectInfo
   * takes precedence (allows per-table configuration). Falls back to @Input binding.
   */
  get showProjectInfoEffective(): boolean {
    if (this.tableData?.data?.showProjectInfo !== undefined) {
      return this.tableData.data.showProjectInfo;
    }
    return this.showProjectInfo;
  }

  getSafeHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeWordHtml(content));
  }

  goToCP(activity: any): void {
    this.analytics.track('News Item Clicked', {
      activity_type: activity.type,
      project_id: activity.project?._id,
      project_name: activity.project?.name,
      has_comment_period: !!activity.pcp,
      is_met: activity.pcp?.isMet || false
    });
    if (activity.pcp?.isMet && activity.pcp?.metURL) {
      window.open(activity.pcp.metURL, '_blank');
    } else {
      this.router.navigate(['p', activity.project._id, 'cp', activity.pcp._id]);
    }
  }

  isSingleDoc(item: any): boolean {
    return item !== '' && item !== null && item !== undefined;
  }

  /**
   * Rewrites old `project-notifications` URLs (legacy site) to the new unified search.
   * All other URLs are returned unchanged.
   */
  getDocUrl(url: string | null | undefined): string {
    return resolveDocUrl(url ?? '') || '#';
  }

  expanded = signal(false);

  toggleDocs(): void {
    this.expanded.update(v => !v);
  }

  /** True when documentUrl is a legacy docs?folder link (no direct file). */
  isFolderDocUrl = computed(() =>
    (this.rowData?.documentUrl ?? '').includes('docs?folder')
  );

  /** MongoDB ObjectId parsed from the documentUrl path, or null. */
  docId = computed((): string | null => {
    const url = this.rowData?.documentUrl ?? '';
    const m = url.match(/\/document\/([a-f0-9]{24})\//i);
    return m ? m[1] : null;
  });

  /** Decoded filename from the last path segment of documentUrl. */
  docFilename = computed((): string | null => {
    const url = this.rowData?.documentUrl ?? '';
    if (!url) return null;
    try {
      const parts = new URL(url, 'http://x').pathname.split('/');
      const last = parts[parts.length - 1];
      return last ? decodeURIComponent(last) : null;
    } catch { return null; }
  });

  /** True only when we have actual content to show in the accordion. */
  hasDocContent = computed((): boolean => {
    if (this.isFolderDocUrl()) return !!this.rowData?.project?._id;
    return !!this.docId();
  });

  /** True when documentUrl is a plain external HTTP(S) link or a bare-domain URL (no scheme). */
  isExternalUrl = computed((): boolean => {
    const url = this.rowData?.documentUrl ?? '';
    if (/^https?:\/\//i.test(url)) return true;
    // Bare-domain with no leading slash and at least one dot (e.g. "www.example.com")
    return !url.startsWith('/') && /\.[a-z]{2,}/i.test(url);
  });

  /** Badge label and CSS class for the activity type, or null for unknown types. */
  activityBadge = computed((): { label: string; cls: string } | null => {
    const type = this.rowData?.type;
    if (!type) return null;
    if (type === 'News') return { label: 'News', cls: 'activity-badge--news' };
    if (type === 'Public Comment Period') return { label: 'Comment Period', cls: 'activity-badge--pcp' };
    if (type.startsWith('Project Notification')) return { label: 'Notification', cls: 'activity-badge--notif' };
    return null;
  });
}
