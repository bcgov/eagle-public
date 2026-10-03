import { Component, OnInit, ViewEncapsulation, ChangeDetectionStrategy, inject, signal, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';

import { ResponsiveService } from '../../services/responsive.service';

import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { ProjectNotificationDocumentsTableDetailsComponent } from '../project-notification-documents-table-details/project-notification-documents-table-details.component';
import { ProjectNotificationDocumentsTableComponent } from '../project-notification-documents-table/project-notification-documents-table.component';
import { CommentPeriodService } from '../../services/commentperiod.service';
import { CommentPeriod } from '../../models/commentperiod';

@Component({
  selector: 'tr[app-project-notifications-table-rows]',
  templateUrl: './project-notifications-table-rows.component.html',
  styleUrls: ['./project-notifications-table-rows.component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProjectNotificationDocumentsTableDetailsComponent,
    ProjectNotificationDocumentsTableComponent,
    DatePipe
],
  standalone: true
})
export class ProjectNotificationsTableRowsComponent implements TableRowComponent, OnInit {
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
  
  private responsive = inject(ResponsiveService);
  private router = inject(Router);
  public commentPeriodService = inject(CommentPeriodService);

  isMobile = this.responsive.isMobile;
  activeTab = signal<'details' | 'documents' | 'commenting'>('details');
  documentsTabLoaded = signal(false);
  commentPeriods = signal<CommentPeriod[] | null>(null);
  showCommentingTab = signal(false);

  ngOnInit() {
    if (this.rowData?.pcp && this.rowData.pcp !== 'none') {
      this.showCommentingTab.set(true);
    } else if (this.rowData && this.rowData.pcp === undefined && this.rowData._id) {
      // Check if legacy DB has any comment periods for this old record
      this.commentPeriodService.getAllByProjectId(this.rowData._id)
        .pipe(take(1))
        .subscribe({
          next: (res: any) => {
            if (res && res.data && res.data.length > 0) {
              this.showCommentingTab.set(true);
            }
          }
        });
    }
  }

  setActiveTab(tab: 'details' | 'documents' | 'commenting') {
    this.activeTab.set(tab);
    if (tab === 'documents' && !this.documentsTabLoaded()) {
      this.documentsTabLoaded.set(true);
    }
    if (tab === 'commenting' && this.commentPeriods() === null) {
      this.getCommentPeriods();
    }
  }

  cpStatus(pcp: string): string {
    if (!pcp || pcp === 'none') return '';
    if (pcp === 'pending') return 'Upcoming';
    return pcp.charAt(0).toUpperCase() + pcp.slice(1);
  }

  getCommentPeriods() {
    if (!this.rowData?._id) {
      this.commentPeriods.set([]);
      return;
    }
    this.commentPeriodService.getAllByProjectId(this.rowData._id)
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          let deduped: CommentPeriod[] = [];
          if (res && res.data && res.data.length > 0) {
            const periods = res.data.map((element: CommentPeriod) => {
              const fullText = element.instructions
                ? element.instructions.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                : '';
              const match = fullText.match(/Comment Period on the (.*?) for /);
              return {
                ...element,
                instructions: match ? match[1] : '',
                additionalText: element.additionalText || fullText || element.informationLabel,
              };
            });
            const seenIds = new Set<string>();
            const seenUrls = new Set<string>();
            deduped = periods.filter((p: CommentPeriod) => {
              if (seenIds.has(p._id)) return false;
              seenIds.add(p._id);
              if (p.isMet && p.metURL) {
                if (seenUrls.has(p.metURL)) return false;
                seenUrls.add(p.metURL);
              }
              return true;
            });
          }

          if (deduped.length === 0 && this.rowData.pcp && this.rowData.pcp !== 'none') {
            const fallback = new CommentPeriod({
              _id: this.rowData._id,
              project: this.rowData._id,
              isMet: this.rowData.isMet,
              metURL: this.rowData.metURL,
              dateStarted: this.rowData.dateStarted,
              dateCompleted: this.rowData.dateCompleted,
              instructions: 'Public Comment Period',
              additionalText: ''
            });
            if (this.rowData.pcp) {
              fallback.commentPeriodStatus = this.cpStatus(this.rowData.pcp);
              if (fallback.commentPeriodStatus === 'Open') {
                if (!fallback.daysRemaining || fallback.daysRemaining === 'Completed' || fallback.daysRemaining === 'None') {
                  fallback.daysRemaining = 'Active';
                }
              }
            }
            deduped = [fallback];
          }

          this.commentPeriods.set(deduped);
        },
        error: () => {
          if (this.rowData.pcp && this.rowData.pcp !== 'none') {
            const fallback = new CommentPeriod({
              _id: this.rowData._id,
              project: this.rowData._id,
              isMet: this.rowData.isMet,
              metURL: this.rowData.metURL,
              dateStarted: this.rowData.dateStarted,
              dateCompleted: this.rowData.dateCompleted,
              instructions: 'Public Comment Period',
              additionalText: ''
            });
            if (this.rowData.pcp) {
              fallback.commentPeriodStatus = this.cpStatus(this.rowData.pcp);
              if (fallback.commentPeriodStatus === 'Open') {
                if (!fallback.daysRemaining || fallback.daysRemaining === 'Completed' || fallback.daysRemaining === 'None') {
                  fallback.daysRemaining = 'Active';
                }
              }
            }
            this.commentPeriods.set([fallback]);
          } else {
            this.commentPeriods.set([]);
          }
        }
      });
  }

  goToCP(commentPeriod: CommentPeriod) {
    if (commentPeriod.isMet && commentPeriod.metURL) {
      window.open(commentPeriod.metURL, '_blank');
    } else if (this.rowData?.associatedProjectId) {
      this.router.navigate(['p', this.rowData.associatedProjectId, 'cp', commentPeriod._id]);
    } else if (this.rowData?._id) {
      this.router.navigate(['pn', this.rowData._id, 'cp', commentPeriod._id]);
    }
  }
}
