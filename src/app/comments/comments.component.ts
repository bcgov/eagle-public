import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectorRef, ViewEncapsulation, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../services/toast.service';
import { CommentPeriod } from '../models/commentperiod';
import { CommentPeriodService } from '../services/commentperiod.service';
import { ProjectService } from '../services/project.service';
import { CommentService } from '../services/comment.service';
import { AddCommentComponent } from './add-comment/add-comment.component';
import { Project } from '../models/project';
import { DocumentService } from '../services/document.service';
import { ApiService } from '../services/api';
import { LoadingStateService } from '../services/loading-state.service';
import { CommentsTableRowsComponent } from './comments-table-rows/comments-table-rows.component';
import { TableObject } from '../shared/components/table-template/table-object';
import { TableTemplateComponent } from '../shared/components/table-template/table-template.component';
import { LoggingService } from '../services/logging.service';
import { AnalyticsService } from '../services/analytics/analytics.service';

@Component({
  selector: 'app-comments',
  imports: [CommonModule, TableTemplateComponent, AddCommentComponent],
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.css'],
  encapsulation: ViewEncapsulation.None,
  standalone: true
})
export class CommentsComponent implements OnInit, OnDestroy {
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private commentService = inject(CommentService);
  private commentPeriodService = inject(CommentPeriodService);
  private projectService = inject(ProjectService);
  private documentService = inject(DocumentService);
  private changeDetectionRef = inject(ChangeDetectorRef);
  private modalService = inject(NgbModal);
  private router = inject(Router);
  private loadingState = inject(LoadingStateService);
  private logger = inject(LoggingService);
  private sanitizer = inject(DomSanitizer);
  private analytics = inject(AnalyticsService);

  loading = this.loadingState.getOperationState('comments');
  commentPeriod = signal<CommentPeriod | null>(null);
  project = signal<Project | null>(null);
  comments = signal<any[]>([]);
  commentPeriodDocs = signal<any[]>([]);
  
  // Sanitized instructions for safe HTML rendering
  sanitizedInstructions = computed(() => {
    const instructions = this.commentPeriod()?.instructions;
    return instructions ? this.sanitizer.bypassSecurityTrustHtml(String(instructions)) : '';
  });
  
  tableData = signal<TableObject>(new TableObject({ component: CommentsTableRowsComponent }));
  commentPeriodHeader = signal('');

  private ngUnsubscribe = new Subject<boolean>();
  private commentPeriodId: string | null = null;
  private ngbModal: NgbModalRef | null = null;

  type = signal<'PROJECT' | 'PROJECT-NOTIFICATION'>('PROJECT');

  ngOnInit() {
    // Initialize table options
    const initialTableData = this.tableData();
    initialTableData.options.showPageCountDisplay = true;
    initialTableData.options.showPagination = true;
    initialTableData.options.showPageSizePicker = true;
    initialTableData.options.showTopControls = true;
    initialTableData.options.showHeader = false;
    initialTableData.options.disableRowHighlight = true;
    initialTableData.currentPage = 1;
    initialTableData.pageSize = 10;
    initialTableData.totalListItems = 0;
    this.tableData.set(initialTableData);

    // Load data from route params (modern pattern - no resolvers)
    this.route.paramMap
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(params => {
        const projId = params.get('projId');
        const commentPeriodId = params.get('commentPeriodId');
        
        if (!projId || !commentPeriodId) {
          this.logger.error('Missing route parameters', 'CommentsComponent', { projId, commentPeriodId });
          this.router.navigate(['/projects']);
          return;
        }

        // Determine if this is a project notification by checking the URL
        const isProjectNotification = this.router.url.includes('/pn/');
        this.type.set(isProjectNotification ? 'PROJECT-NOTIFICATION' : 'PROJECT');

        // Load project data
        this.projectService.getById(projId)
          .pipe(takeUntil(this.ngUnsubscribe))
          .subscribe({
            next: (project) => {
              this.project.set(project);
            },
            error: (error) => {
              this.logger.error('Error loading project', 'CommentsComponent', error);
            }
          });

        // Load comment period data
        this.commentPeriodService.getById(commentPeriodId)
          .pipe(takeUntil(this.ngUnsubscribe))
          .subscribe({
            next: (period) => {
              if (!period) {
                this.toastService.show('Comment period not found', '', { duration: 3000, type: 'error' });
                this.router.navigate(['/projects']);
                return;
              }

              this.commentPeriod.set(period);
              this.commentPeriodId = period._id;
              
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

              this.loadComments();
            },
            error: (error) => {
              this.logger.error('Error loading comment period', 'CommentsComponent', error);
              this.toastService.show('Failed to load comment period', '', { duration: 3000, type: 'error' });
              this.router.navigate(['/projects']);
            }
          });
      });
  }

  private loadComments() {
    if (!this.commentPeriodId) return;

    const currentTableData = this.tableData();
    this.commentService.getByPeriodId(this.commentPeriodId, currentTableData.currentPage, currentTableData.pageSize, true)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(async (res: any) => {
        const currentComments = res.currentComments;

        // Initialize expanded property
        currentComments.forEach((comment: any) => {
          comment.expanded = false;
        });

        // Collect all document IDs from all comments
        const allDocIds: string[] = [];
        const commentDocMap = new Map<string, string[]>(); // Map comment index to its document IDs

        currentComments.forEach((comment: any, index: number) => {
          if (comment.documents && comment.documents.length > 0) {
            const docIds = comment.documents.map((doc: any) => {
              // Handle both string IDs and objects with _id property
              return typeof doc === 'string' ? doc : (doc._id || doc);
            });
            commentDocMap.set(index.toString(), docIds);
            allDocIds.push(...docIds);
          }
        });

        // Load all documents in a single batch request
        if (allDocIds.length > 0) {
          try {
            const allDocs = await this.documentService.getByMultiId(allDocIds).toPromise();
            
            // Create a map of document ID to document object for quick lookup
            const docMap = new Map<string, any>();
            allDocs?.forEach((doc: any) => {
              if (doc && doc._id) {
                docMap.set(doc._id, doc);
              }
            });

            // Assign documents back to their respective comments
            currentComments.forEach((comment: any, index: number) => {
              const docIds = commentDocMap.get(index.toString());
              if (docIds) {
                comment.documents = docIds
                  .map(id => docMap.get(id))
                  .filter(doc => doc !== undefined);
              }
            });
          } catch (error) {
            this.logger.error('Error loading documents for comments', 'CommentsComponent', error);
            currentComments.forEach((comment: any) => {
              if (comment.documents) {
                comment.documents = [];
              }
            });
          }
        }

        this.comments.set(currentComments);

        // Create new TableObject with updated data
        const currentTableData = this.tableData();
        const newTableData = new TableObject({ component: CommentsTableRowsComponent });
        newTableData.options = currentTableData.options;
        newTableData.currentPage = currentTableData.currentPage;
        newTableData.pageSize = currentTableData.pageSize;
        newTableData.totalListItems = res.totalCount;
        newTableData.items = currentComments.map((comment: any) => ({ rowData: comment }));

        this.logger.debug(`Loaded ${currentComments.length} comments, tableData.items length: ${newTableData.items.length}, totalListItems: ${newTableData.totalListItems}`, 'CommentsComponent');

        this.tableData.set(newTableData);
        this.changeDetectionRef.detectChanges();
      });
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
    this.api.downloadDocument(document)
      .then(() => {
        this.toastService.show('Downloading document', '', { duration: 2000, type: 'info' });
      })
      .catch(() => {
        this.toastService.show('Error opening document! Please try again later', '', { duration: 2000, type: 'error' });
      });
  }

  addComment() {
    if (this.commentPeriodId) {
      // open modal
      this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
      // set input parameters
      const modalInstance = this.ngbModal.componentInstance as any;
      modalInstance.currentPeriod = this.commentPeriod();
      modalInstance.project = this.project();
      
      // Store current page for tracking on dismiss
      const currentPage = modalInstance.currentPage?.() || 1;
      
      // check result
      this.ngbModal.result.then(
        value => {
          this.logger.debug('Modal closed with success', 'CommentsComponent', { value });
        },
        reason => {
          this.logger.debug('Modal cancelled', 'CommentsComponent', { reason });
          
          // Track modal dismissal
          const proj = this.project();
          if (proj) {
            this.analytics.track('Comment Modal Dismissed', {
              project_id: proj._id,
              project_name: proj.name,
              comment_period_id: this.commentPeriodId,
              page: currentPage,
              reason: String(reason || 'unknown')
            });
          }
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
    const currentTableData = this.tableData();
    currentTableData.currentPage = pageNumber;
    this.tableData.set(currentTableData);
    this.loadComments();
  }

  onUpdatePageSize(newPageSize: number) {
    const currentTableData = this.tableData();
    currentTableData.pageSize = Number(newPageSize);
    currentTableData.currentPage = 1; // Reset to first page when changing page size
    this.tableData.set(currentTableData);
    this.getPaginatedComments(1);
    this.changeDetectionRef.detectChanges();
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
