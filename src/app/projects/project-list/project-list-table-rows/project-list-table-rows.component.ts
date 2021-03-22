import { Component } from '@angular/core';

import { Router } from '@angular/router';
import { TableRowComponent } from 'app/shared/components/table-template-2/table-row-component';

@Component({
    selector: 'tr[app-project-list-table-rows]',
    templateUrl: './project-list-table-rows.component.html',
    styleUrls: ['./project-list-table-rows.component.scss']
})

export class ProjectListTableRowsComponent extends TableRowComponent {
    constructor(
        private router: Router
    ) {
        super();
    }

    goToProject(project) {
        this.router.navigate([`p/${project._id}/project-details`]);
    }
}
