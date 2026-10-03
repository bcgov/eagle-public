import { Component, EventEmitter, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { sanitizeWordHtml } from 'app/shared/utils/word-html-sanitizer';
import { rewriteLegacyDocumentLinks, rewriteLegacyDocumentUrl } from 'app/shared/utils/legacy-document-url';
import { ConfigService } from 'app/services/config.service';
import { isSafeUrl } from 'app/shared/utils/safe-url';

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
  selector: 'tr[app-activity-card]',
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, DatePipe],
  standalone: true
})
export class ActivityCardComponent implements TableRowComponent {
  private router = inject(Router);
  private analytics = inject(AnalyticsService);
  private configService = inject(ConfigService);

  private row: any = null;
  /** The update text with legacy document links rewritten; Angular's sanitizer runs on binding. */
  contentHtml = '';

  // TableRowComponent interface — set by TableRowDirective in table context
  @Input() set rowData(value: any) {
    this.row = value;
    this.contentHtml = rewriteLegacyDocumentLinks(sanitizeWordHtml(value?.content), this.configService.getSearchApiPath());
  }
  get rowData(): any {
    return this.row;
  }
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

  /** Old updates link eagle-api document routes; those now point at the demi-search download. */
  documentHref(url: string): string {
    return rewriteLegacyDocumentUrl(url, this.configService.getSearchApiPath());
  }

  goToCP(activity: any): void {
    this.analytics.track('News Item Clicked', {
      activity_type: activity.type,
      project_id: activity.project?._id,
      project_name: activity.project?.name,
      has_comment_period: !!activity.pcp,
      is_met: activity.pcp?.isMet || false
    });
    if (activity.pcp?.isMet && isSafeUrl(activity.pcp.metURL)) {
      window.open(activity.pcp.metURL, '_blank');
    } else {
      this.router.navigate(['p', activity.project._id, 'cp', activity.pcp._id]);
    }
  }

  isSingleDoc(item: any): boolean {
    return item !== '' && item !== null && item !== undefined;
  }
}
