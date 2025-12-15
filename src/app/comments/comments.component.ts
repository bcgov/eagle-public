import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommentPeriod } from '../models/commentperiod';
import { CommentService } from '../services/comment.service';
import { AddCommentComponent } from './add-comment/add-comment.component';
import { Project } from '../models/project';
import { DocumentService } from '../services/document.service';
import { ApiService } from '../services/api';
import { CommentsTableRowsComponent } from './comments-table-rows/comments-table-rows.component';
import { TableObject } from '../shared/components/table-template/table-object';
import { TableTemplateComponent } from '../shared/components/table-template/table-template.component';

@Component({
  selector: 'app-comments',
  imports: [CommonModule, TableTemplateComponent],
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.css'],
  standalone: true
})
export class CommentsComponent implements OnInit, OnDestroy {
  private snackBar = inject(MatSnackBar);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private commentService = inject(CommentService);
  private documentService = inject(DocumentService);
  private changeDetectionRef = inject(ChangeDetectorRef);
  private modalService = inject(NgbModal);
  private router = inject(Router);

  loading = signal(true);
  commentsLoading = signal(true);
  loadingDoc = signal(false);
  commentPeriod = signal<CommentPeriod | null>(null);
  project = signal<Project | null>(null);
  comments = signal<any[]>([]);
  commentPeriodDocs = signal<any[]>([]);
  
  tableData = new TableObject({ component: CommentsTableRowsComponent });
  commentPeriodHeader = signal('');

  private ngUnsubscribe = new Subject<boolean>();
  private commentPeriodId: string | null = null;
  private ngbModal: NgbModalRef | null = null;

  type = signal<'PROJECT' | 'PROJECT-NOTIFICATION'>('PROJECT');

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
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        (data: any) => {

        if (data.project && (data.project as any)[0]) {
          this.type.set('PROJECT-NOTIFICATION');
          this.project.set((data.project as any)[0].data.searchResults[0]);
        } else {
          this.type.set('PROJECT');
          this.project.set(data.project ? data.project : null);
        }

          if (data.commentPeriod) {
            this.commentPeriod.set(data.commentPeriod);
            const period = data.commentPeriod;
            
            if (period.commentPeriodStatus === 'Closed') {
              this.commentPeriodHeader.set('Public Comment Period is Now Closed');
            } else if (period.commentPeriodStatus === 'Pending') {
              this.commentPeriodHeader.set('Public Comment Period is Pending');
            } else if (period.commentPeriodStatus === 'Open') {
              this.commentPeriodHeader.set('Public Comment Period is Now Open');
            }

            if (period.relatedDocuments && period.relatedDocuments.length > 0) {
              this.documentService.getByMultiId(period.relatedDocuments)
                .pipe(takeUntil(this.ngUnsubscribe))
                .subscribe(docs => {
                  this.commentPeriodDocs.set(docs);
                  this.changeDetectionRef.detectChanges();
                });
            }
            this.commentPeriodId = period._id;
            this.commentService.getByPeriodId(this.commentPeriodId!, this.tableData.currentPage, this.tableData.pageSize, true)
              .pipe(takeUntil(this.ngUnsubscribe))
              .subscribe(async (res: any) => {
                const currentComments = res.currentComments;
                this.tableData.totalListItems = res.totalCount;

                // Initialize expanded property and load documents for each comment
                for (let comment of currentComments) {
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

                this.comments.set(currentComments);

                // Wrap comments in rowData object for table-template-2
                this.tableData.items = currentComments.map((comment: any) => {
                  return { rowData: comment };
                });

                this.loading.set(false);
                this.changeDetectionRef.detectChanges();
              });

          } else {
            alert('Uh-oh, couldn\'t load comment period');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );
  }

  onMessageOut(msg: any) {
    // Handle table messages like pagination
    if (msg.label === 'pageNum') {
      this.getPaginatedComments(msg.data);
    } else if (msg.label === 'pageSize') {
      this.onUpdatePageSize(msg.data.value);
    }
  }

  downloadDocument(document: any) {
    this.loadingDoc.set(true);
    this.api.downloadDocument(document)
      .then(() => {
        this.loadingDoc.set(false);
        this.snackBar.open('Downloading document');
        window.setTimeout(() => this.snackBar.dismiss(), 2000);
      })
      .catch(() => {
        this.loadingDoc.set(false);
        this.snackBar.open('Error opening document! Please try again later');
        window.setTimeout(() => this.snackBar.dismiss(), 2000);
      });
  }

  addComment() {
    if (this.commentPeriodId) {
      // open modal
      this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
      // set input parameter
      (this.ngbModal.componentInstance as any).currentPeriod = this.commentPeriod();
      (this.ngbModal.componentInstance as any).project = this.project();
      // check result
      this.ngbModal.result.then(
        value => {
          console.log(`Success, value = ${value}`);
        },
        reason => {
          console.log(`Cancelled, reason = ${reason}`);
        }
      );
    }
  }

  goBackToProjectDetails() {
    const proj = this.project();
    if (this.type() === 'PROJECT' && proj) {
      this.router.navigate(['/p', proj._id]);
    } else {
      this.router.navigate(['/project-notifications']);
    }
  }

  getPaginatedComments(pageNumber: number) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);
    this.loading.set(true);

    this.tableData.currentPage = pageNumber;

    if (!this.commentPeriodId) return;

    this.commentService.getByPeriodId(this.commentPeriodId, this.tableData.currentPage, this.tableData.pageSize, true)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async (res: any) => {
        this.tableData.totalListItems = res.totalCount;
        const currentComments = res.currentComments;

        // Initialize expanded property and load documents for each comment
        for (let comment of currentComments) {
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

        this.comments.set(currentComments);

        // Wrap comments in rowData object for table-template-2
        this.tableData.items = currentComments.map((comment: any) => {
          return { rowData: comment };
        });

        this.loading.set(false);
        this.changeDetectionRef.detectChanges();
      });
  }

  onUpdatePageSize(newPageSize: number) {
    this.tableData.pageSize = Number(newPageSize);
    this.tableData.currentPage = 1; // Reset to first page when changing page size
    this.getPaginatedComments(1);
    this.changeDetectionRef.detectChanges();
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
