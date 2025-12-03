import { Component, OnInit, OnDestroy } from '@angular/core';
import { TableRowComponent } from 'app/shared/components/table-template/table-row-component';
import { ApiService } from 'app/services/api';

@Component({
  selector: 'tbody[app-comments-table-rows]',
  templateUrl: './comments-table-rows.component.html',
  styleUrls: ['./comments-table-rows.component.scss']
})

export class CommentsTableRowsComponent extends TableRowComponent implements OnInit, OnDestroy {

  constructor(
    private api: ApiService
  ) {
    super();
  }

  ngOnInit() {
    // Table row component initialization handled by parent
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  toggle(comment) {
    comment.expanded = !comment.expanded;

    // CHANGE THE NAME OF THE BUTTON.
    if (comment.expanded) {
      comment.buttonName = 'Read Less';
    } else {
      comment.buttonName = 'Read More';
    }
  }

  public openAttachment(file) {
    this.api.openDocument(file);
  }
}
