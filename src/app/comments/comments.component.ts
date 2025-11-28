import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs/Subject';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBar } from '@angular/material';
import { CommentPeriod } from 'app/models/commentperiod';

import { CommentService } from 'app/services/comment.service';
import { AddCommentComponent } from './add-comment/add-comment.component';
import { Project } from 'app/models/project';
import { DocumentService } from 'app/services/document.service';
import { ApiService } from 'app/services/api';
import { CommentsTableRowsComponent } from 'app/comments/comments-table-rows/comments-table-rows.component';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';

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
  public comments: any[]; // Changed from Comment[] to allow expanded property
  public commentPeriodDocs;

  public tableData: TableObject2 = new TableObject2({ component: CommentsTableRowsComponent });
  public commentPeriodHeader: String;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private commentPeriodId = null;
  private ngbModal: NgbModalRef = null;

  public type = 'PROJECT';

  constructor(
    public snackBar: MatSnackBar,
    private api: ApiService,
    private route: ActivatedRoute,
    private commentService: CommentService,
    private documentService: DocumentService,
    private _changeDetectionRef: ChangeDetectorRef,
    private modalService: NgbModal,
    private router: Router
  ) { }

  ngOnInit() {
    // Initialize table options
    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;
    this.tableData.options.showPageSizePicker = true;
    this.tableData.options.showTopControls = true;
    this.tableData.options.showHeader = false;
    this.tableData.options.disableRowHighlight = true;
    this.tableData.currentPage = 1;
    this.tableData.pageSize = 10;
    this.tableData.totalListItems = 0;

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
            this.commentService.getByPeriodId(this.commentPeriodId, this.tableData.currentPage, this.tableData.pageSize, true)
              .takeUntil(this.ngUnsubscribe)
              .subscribe(async (res: any) => {
                this.comments = res.currentComments;
                this.tableData.totalListItems = res.totalCount;
                
                // Initialize expanded property and load documents for each comment
                for (let comment of this.comments) {
                  comment.expanded = false;
                  if (comment.documents && comment.documents.length > 0) {
                    // Load document details
                    let documents = [];
                    for (let docId of comment.documents) {
                      try {
                        const doc = await this.api.getDocument(docId).toPromise();
                        if (doc && doc[0]) {
                          documents.push(doc[0]);
                        }
                      } catch (error) {
                        console.error('Error loading document:', error);
                      }
                    }
                    comment.documents = documents;
                  }
                }
                
                // Wrap comments in rowData object for table-template-2
                this.tableData.items = this.comments.map(comment => {
                  return { rowData: comment };
                });

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


  onMessageOut(msg: ITableMessage) {
    // Handle table messages like pagination
    if (msg.label === 'pageNum') {
      this.getPaginatedComments(msg.data);
    } else if (msg.label === 'pageSize') {
      this.onUpdatePageSize(msg.data.value);
    }
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
    window.scrollTo(0, 0);
    this.loading = true;

    this.tableData.currentPage = pageNumber;

    this.commentService.getByPeriodId(this.commentPeriodId, this.tableData.currentPage, this.tableData.pageSize, true)
      .takeUntil(this.ngUnsubscribe)
      .subscribe(async (res: any) => {
        this.tableData.totalListItems = res.totalCount;
        this.comments = res.currentComments;
        
        // Initialize expanded property and load documents for each comment
        for (let comment of this.comments) {
          comment.expanded = false;
          if (comment.documents && comment.documents.length > 0) {
            // Load document details
            let documents = [];
            for (let docId of comment.documents) {
              try {
                const doc = await this.api.getDocument(docId).toPromise();
                if (doc && doc[0]) {
                  documents.push(doc[0]);
                }
              } catch (error) {
                console.error('Error loading document:', error);
              }
            }
            comment.documents = documents;
          }
        }

        // Wrap comments in rowData object for table-template-2
        this.tableData.items = this.comments.map(comment => {
          return { rowData: comment };
        });

        this.loading = false;
        this._changeDetectionRef.detectChanges();
      });
  }

  onUpdatePageSize(newPageSize: number) {
    this.tableData.pageSize = Number(newPageSize);
    this.tableData.currentPage = 1; // Reset to first page when changing page size
    this.getPaginatedComments(1);
    this._changeDetectionRef.detectChanges();
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
