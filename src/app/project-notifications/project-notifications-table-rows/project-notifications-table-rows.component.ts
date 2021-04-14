import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material';

import { ApiService } from 'app/services/api';
import { TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';

@Component({
  selector: 'tr[app-project-notifications-table-rows]',
  templateUrl: './project-notifications-table-rows.component.html',
  styleUrls: ['./project-notifications-table-rows.component.scss']
})

export class ProjectNotificationsTableRowsComponent extends TableRowComponent {
  constructor(
    private api: ApiService,
    public snackBar: MatSnackBar,
  ) {
    super();
  }

  downloadDocuments(project) {
    project.documents.forEach(doc => {
      this.api.downloadDocument(doc)
        .then(() => {
          // Turn this into a toast
          this.snackBar.open('Downloading document');
          window.setTimeout(() => this.snackBar.dismiss(), 2000)
        })
        .catch(() => {
          this.snackBar.open('Error opening document! Please try again later');
          window.setTimeout(() => this.snackBar.dismiss(), 2000)
        })
    });
  }

  getTrigger(project) {
    return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
  }
}
