import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NewlinesPipe } from '../../shared/pipes/newlines.pipe';

@Component({
  selector: 'app-project-notification-documents-table-details',
  templateUrl: './project-notification-documents-table-details.component.html',
  styleUrls: ['./project-notification-documents-table-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, NewlinesPipe]
})
export class ProjectNotificationDocumentsTableDetailsComponent {
  rowData = input.required<any>();

  getTrigger(project: any) {
    return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
  }
}
