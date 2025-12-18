import { Component, ChangeDetectionStrategy, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';

@Component({
  selector: 'tbody[app-news-list-table-rows]',
  templateUrl: './news-list-table-rows.component.html',
  styleUrl: './news-list-table-rows.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  standalone: true
})
export class NewsListTableRowsComponent implements TableRowComponent {
  private router = inject(Router);

  rowData: any;
  tableData: any;
  messageIn = new EventEmitter<ITableMessage>();
  messageOut = new EventEmitter<ITableMessage>();

  goToCP(activity: any): void {
    if (activity.pcp?.isMet && activity.pcp?.metURL) {
      window.open(activity.pcp.metURL, '_blank', 'noopener');
    } else if (activity.project?._id && activity.pcp?._id) {
      this.router.navigate(['p', activity.project._id, 'cp', activity.pcp._id]);
    }
  }

  isSingleDoc(item: any): boolean {
    return item !== '' && item !== null;
  }
}
