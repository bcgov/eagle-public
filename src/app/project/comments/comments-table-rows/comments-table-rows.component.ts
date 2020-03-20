import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { ApiService } from 'app/services/api';
import { TableObject } from 'app/shared/components/table-template/table-object';

@Component({
  selector: 'app-comments-table-rows',
  templateUrl: './comments-table-rows.component.html',
  styleUrls: ['./comments-table-rows.component.scss']
})

export class CommentsTableRowsComponent implements OnInit {
  @Input() data: TableObject;

  public comments: any;
  public paginationData: any;
  public loading = true;

  constructor(
    private api: ApiService,
    private _changeDetectionRef: ChangeDetectorRef,
  ) { }

  ngOnInit() {

    this.comments = this.data.data;
    this.paginationData = this.data.paginationData;

    // Populate the documents for this item.
    this.comments.map(async comment => {
      comment.expanded = false;
      comment.buttonName = 'Read More';
      if (comment.documents && comment.documents.length > 0) {
        // populate the docs.
        let documents = [];
        for (let doc of comment.documents) {
          let docs = await this.api.getDocument(doc)
            .map(async (res: any) => {
              let record = res;
              // console.log("record:", record[0]);
              return record[0];
            }).toPromise();
          documents.push(docs);
        }
        comment.documents = documents;
        this._changeDetectionRef.detectChanges();
      }
      this.loading = false;
    });
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
