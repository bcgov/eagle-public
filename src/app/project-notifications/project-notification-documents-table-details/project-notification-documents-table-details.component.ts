import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

import { RouterModule } from '@angular/router';

import { NewlinesPipe } from '../../shared/pipes/newlines.pipe';

@Component({
  selector: 'app-project-notification-documents-table-details',
  templateUrl: './project-notification-documents-table-details.component.html',
  styleUrls: ['./project-notification-documents-table-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, NewlinesPipe],
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

  getTrigger(project: any): string | null {
    return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
  }
}
