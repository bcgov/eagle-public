import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-project-notification-documents-table-details',
    templateUrl: './project-notification-documents-table-details.component.html',
    styleUrls: ['./project-notification-documents-table-details.component.scss']
})

export class ProjectNotificationDocumentsTableDetailsComponent {
    @Input() rowData;

    constructor() { }

    getTrigger(project) {
        return project && project.trigger ? project.trigger.replace(/,/g, ', ') : null;
    }
}
