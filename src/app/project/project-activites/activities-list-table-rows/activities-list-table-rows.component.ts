import { Component } from '@angular/core';

import { Router } from '@angular/router';
import { TableRowComponent } from 'app/shared/components/table-template/table-row-component';

@Component({
  selector: 'tr[app-activities-list-table-rows]',
  templateUrl: './activities-list-table-rows.component.html',
  styleUrls: ['./activities-list-table-rows.component.scss']
})

export class ActivitiesListTableRowsComponent extends TableRowComponent {
  constructor(private router: Router) {
    super();
  }

  goToCP(activity) {
    if (activity.pcp.isMet && activity.pcp.metURL) {
      window.open(activity.pcp.metURL, '_blank');
    } else {
      this.router.navigate(['p', activity.project._id, 'cp', activity.pcp._id]);
    }
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
