import { Component, EventEmitter, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { AnalyticsService } from 'app/services/analytics/analytics.service';

@Component({
  selector: 'tr[app-activities-list-table-rows]',
  templateUrl: './activities-list-table-rows.component.html',
  styleUrls: ['./activities-list-table-rows.component.css'],
  imports: [CommonModule, DatePipe],
  standalone: true
})
export class ActivitiesListTableRowsComponent implements TableRowComponent {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private analytics = inject(AnalyticsService);

  // TableRowComponent interface properties
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  goToCP(activity: any) {
    // Track comment period view from activities
    this.analytics.track('News Item Clicked', {
      activity_type: activity.type,
      project_id: activity.project?._id,
      project_name: activity.project?.name,
      has_comment_period: !!activity.pcp,
      is_met: activity.pcp?.isMet || false
    });
    
    if (activity.pcp.isMet && activity.pcp.metURL) {
      window.open(activity.pcp.metURL, '_blank');
    } else {
      this.router.navigate(['p', activity.project._id, 'cp', activity.pcp._id]);
    }
  }

  isSingleDoc(item: any): boolean {
    return item !== '' && item !== null;
  }

  getSafeHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content || '');
  }
}
