import { Component, inject, input, output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api';
import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';

@Component({
  selector: 'tbody[app-comments-table-rows]',
  imports: [CommonModule],
  templateUrl: './comments-table-rows.component.html',
  styleUrls: ['./comments-table-rows.component.css'],
  standalone: true
})
export class CommentsTableRowsComponent implements TableRowComponent {
  private api = inject(ApiService);
  
  rowData = input<any>();
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  toggle(comment: any) {
    comment.expanded = !comment.expanded;

    // CHANGE THE NAME OF THE BUTTON.
    if (comment.expanded) {
      comment.buttonName = 'Read Less';
    } else {
      comment.buttonName = 'Read More';
    }
  }

  openAttachment(file: any) {
    this.api.openDocument(file);
  }
}
