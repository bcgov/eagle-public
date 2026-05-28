import { Component, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'tr[app-search-project-table-rows]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <td data-label="Name" class="col-2">{{ rowData.name || '-' }}</td>
    <td data-label="Proponent" class="col-2">{{ rowData.proponent || '-' }}</td>
    <td data-label="Type" class="col-2">{{ rowData.type || '-' }}</td>
    <td data-label="Region" class="col-2">{{ rowData.region || '-' }}</td>
    <td data-label="Phase" class="col-2">{{ rowData.currentPhaseName || '-' }}</td>
    <td data-label="Decision" class="col-2">{{ rowData.eacDecision || '-' }}</td>
  `,
  host: {
    'class': 'clickable-row',
    'tabindex': '0',
    '(click)': 'goToProject()',
    '(keyup.enter)': 'goToProject()',
  },
})
export class SearchProjectTableRowsComponent implements TableRowComponent {
  private router = inject(Router);

  rowData: any;
  tableData!: TableObject;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();

  goToProject(): void {
    if (this.rowData._id) {
      this.router.navigate([`p/${this.rowData._id}/project-details`]);
    }
  }
}
