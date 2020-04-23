import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs/Subject';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBar } from '@angular/material';
import { CommentPeriod } from 'app/models/commentperiod';
import { Comment } from 'app/models/comment';

import { CommentService } from 'app/services/comment.service';
import { AddCommentComponent } from './add-comment/add-comment.component';
import { Project } from 'app/models/project';
import { DocumentService } from 'app/services/document.service';
import { ApiService } from 'app/services/api';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { CommentsTableRowsComponent } from 'app/comments/comments-table-rows/comments-table-rows.component';

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss']
})
export class CommentsComponent implements OnInit, OnDestroy {
  public loading = true;
  public commentsLoading = true;
  public loadingDoc = false;
  public commentPeriod: CommentPeriod;
  public project: Project;
  public comments: Comment[];
  public commentPeriodDocs;

  public commentTableData: TableObject;
  public commentPeriodHeader: String;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private commentPeriodId = null;
  private ngbModal: NgbModalRef = null;

  public tableParams: TableParamsObject = new TableParamsObject();
  public commentTableColumns = [];

  public type = 'PROJECT';

  constructor(
    public snackBar: MatSnackBar,
    private api: ApiService,
    private route: ActivatedRoute,
    private commentService: CommentService,
    private documentService: DocumentService,
    private _changeDetectionRef: ChangeDetectorRef,
    private modalService: NgbModal,
    private router: Router,
    private tableTemplateUtils: TableTemplateUtils
  ) { }

  ngOnInit() {
    // Get page size and current page from url
    this.route.params.subscribe(params => {
      this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params);
    });

    // get data from route resolver
    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        (data: { commentPeriod: CommentPeriod, project: Project }) => {

        if (data.project[0]) {
          this.type = 'PROJECT-NOTIFICATION';
          this.project = data.project[0].data.searchResults[0];
        } else {
          this.type = 'PROJECT';
          this.project = data.project ? data.project : null;
        }

          if (data.commentPeriod) {
            // To fix the issue where the last page is empty.
            this.commentPeriod = data.commentPeriod;
            if (this.commentPeriod.commentPeriodStatus === 'Closed') {
              this.commentPeriodHeader = 'Public Comment Period is Now Closed';
            } else if (this.commentPeriod.commentPeriodStatus === 'Pending') {
              this.commentPeriodHeader = 'Public Comment Period is Pending';
            } else if (this.commentPeriod.commentPeriodStatus === 'Open') {
              this.commentPeriodHeader = 'Public Comment Period is Now Open';
            }

            if (this.commentPeriod.relatedDocuments && this.commentPeriod.relatedDocuments.length > 0) {
              this.documentService.getByMultiId(this.commentPeriod.relatedDocuments)
                .takeUntil(this.ngUnsubscribe)
                .subscribe(docs => {
                  this.commentPeriodDocs = docs;
                  this._changeDetectionRef.detectChanges();
                });
            }
            this.commentPeriodId = this.commentPeriod._id;
            this.commentService.getByPeriodId(this.commentPeriodId, this.tableParams.currentPage, this.tableParams.pageSize, true)
              .takeUntil(this.ngUnsubscribe)
              .subscribe((res: any) => {
                this.comments = res.currentComments;
                this.tableParams.totalListItems = res.totalCount;
                this.commentTableColumns = [
                  {
                    name: `Showing ${this.comments.length} comments out of ${this.tableParams.totalListItems}:`,
                    value: 'comment',
                    width: 'no-sort',
                    nosort: true
                  },
                ];
                this.setCommentRowData();

                this.loading = false;
                this._changeDetectionRef.detectChanges();
              });

          } else {
            alert('Uh-oh, couldn\'t load comment period');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );
  }


  setCommentRowData() {
    this.commentTableData = new TableObject(
      CommentsTableRowsComponent,
      this.comments,
      this.tableParams
    );
  }

  setColumnSort(column) {
    if (this.tableParams.sortBy.charAt(0) === '+') {
      this.tableParams.sortBy = '-' + column;
    } else {
      this.tableParams.sortBy = '+' + column;
    }
    this.getPaginatedComments(this.tableParams.currentPage);
  }

  public downloadDocument(document) {
    this.loadingDoc = true;
    this.api.downloadDocument(document)
      .then(() => {
        // Turn this into a toast
        this.loadingDoc = false;
        this.snackBar.open('Downloading document');
        window.setTimeout(() => this.snackBar.dismiss(), 2000)
      })
      .catch(() => {
        this.loadingDoc = false;
        this.snackBar.open('Error opening document! Please try again later');
        window.setTimeout(() => this.snackBar.dismiss(), 2000)
      })

  }

  public addComment() {
    if (this.commentPeriodId) {
      // open modal
      this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
      // set input parameter
      (<AddCommentComponent>this.ngbModal.componentInstance).currentPeriod = this.commentPeriod;
      (<AddCommentComponent>this.ngbModal.componentInstance).project = this.project;
      // check result
      this.ngbModal.result.then(
        value => {
          // saved
          console.log(`Success, value = ${value}`);
        },
        reason => {
          // cancelled
          console.log(`Cancelled, reason = ${reason}`);
        }
      );
    }
  }

  public goBackToProjectDetails() {
    if (this.type === 'PROJECT') {
      this.router.navigate(['/p', this.project._id]);
    } else {
      this.router.navigate(['/project-notifications']);
    }
  }

  getPaginatedComments(pageNumber) {
    // Go to top of page after clicking to a different page.
    // window.scrollTo(0, 0);
    this.loading = true;

    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, this.tableParams.sortBy);

    this.commentService.getByPeriodId(this.commentPeriodId, this.tableParams.currentPage, this.tableParams.pageSize, true)
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        this.tableParams.totalListItems = res.totalCount;
        this.comments = res.currentComments;
        this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize);
        this.setCommentRowData();
        this.loading = false;
        this._changeDetectionRef.detectChanges();
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
