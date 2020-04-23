import { Component, Input, OnInit } from '@angular/core';

import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Router } from '@angular/router';

@Component({
    selector: 'tbody[app-project-list-table-rows]',
    templateUrl: './project-list-table-rows.component.html',
    styleUrls: ['./project-list-table-rows.component.scss']
})

export class ProjectListTableRowsComponent implements OnInit, TableComponent {
    @Input() data: TableObject;

    public projects: any;
    public paginationData: any;

    constructor(
        private router: Router
    ) { }

    ngOnInit() {
        this.projects = this.data.data;
        this.paginationData = this.data.paginationData;
    }

    goToProject(project) {
      this.router.navigate([`p/${project._id}/project-details`]);
    }
}
