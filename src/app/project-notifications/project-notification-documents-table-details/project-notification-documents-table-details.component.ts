import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NewlinesPipe } from '../../shared/pipes/newlines.pipe';

@Component({
  selector: 'app-project-notification-documents-table-details',
  templateUrl: './project-notification-documents-table-details.component.html',
  styleUrls: ['./project-notification-documents-table-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, NewlinesPipe, DatePipe],
  standalone: true
})
export class ProjectNotificationDocumentsTableDetailsComponent {
  rowData = input.required<any>();
  
  decisionText = computed(() => {
    const data = this.rowData();
    const decision = data.decision || '-';
    const dateStr = data.decisionDate?.toString().split('T')[0];
    return dateStr 
      ? `Notification Decision - ${decision} | ${dateStr}`
      : `Notification Decision - ${decision}`;
  });

  cpStatus = computed(() => {
    const pcp = this.rowData().pcp as string | undefined;
    if (!pcp || pcp === 'none') return null;
    if (pcp === 'pending') return 'Upcoming';
    return pcp.charAt(0).toUpperCase() + pcp.slice(1);
  });

  cpDates = computed(() => {
    const d = this.rowData();
    if (!d.dateStarted && !d.dateCompleted) return null;
    return { start: d.dateStarted as string | null, end: d.dateCompleted as string | null };
  });

  getTrigger(project: any): string | null {
    return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
  }
}
