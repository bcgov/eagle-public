import { Component, Input, OnInit } from '@angular/core';

import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Router } from '@angular/router';

@Component({
    selector: 'tbody[app-activities-list-table-rows]',
    templateUrl: './activities-list-table-rows.component.html',
    styleUrls: ['./activities-list-table-rows.component.scss']
})

export class ActivitiesListTableRowsComponent implements OnInit, TableComponent {
    @Input() data: TableObject;

    public activities: any;
    public paginationData: any;

    constructor(
      private router: Router
    ) { }

    ngOnInit() {
        // TODO: We need to get the legislation specific data in here to get the project name in the table rows component
        this.activities = this.data && this.data.data || null;
        this.paginationData = this.data.paginationData;
    }

    goToCP(activity) {
      this.router.navigate(['p', activity.project._id, 'cp', activity.pcp]);
    }

    isSingleDoc(item) {
      if (item !== ''
         && item !== null
         ) {
        return true;
      } else {
        return false;
      }
    }
}
