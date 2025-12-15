import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project } from '../../models/project';
import { CommentPeriodService } from '../../services/commentperiod.service';
import { CommentPeriod } from '../../models/commentperiod';

@Component({
  selector: 'app-commenting-tab',
  imports: [CommonModule],
  templateUrl: './commenting-tab.component.html',
  styleUrls: ['./commenting-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentingTabComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public commentPeriodService = inject(CommentPeriodService);
  private _changeDetectionRef = inject(ChangeDetectorRef);

  public currentProject: Project | null = null;
  public loading = true;
  public commentPeriods: Array<CommentPeriod> = [];
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  ngOnInit() {
    // get project
    this.route.parent?.data
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
        (data: any) => {
          const results = data.project;
          if (results) {
            this.currentProject = results;
            if (this.currentProject) {
              this.getCommentPeriods(this.currentProject._id);
            }
          } else {
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
          this.loading = false;
          this._changeDetectionRef.detectChanges();
        }
      );
  }

  goToCP(commentPeriod: CommentPeriod) {
    if (commentPeriod.isMet && commentPeriod.metURL) {
      window.open(commentPeriod.metURL, '_blank');
    } else {
      this.router.navigate(['p', this.currentProject!._id, 'cp', commentPeriod._id]);
    }
  }

  getCommentPeriods(projectId: string) {
    this.commentPeriodService.getAllByProjectId(projectId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((res: any) => {
        if (res.data) {
          this.commentPeriods = res.data;
          this.commentPeriods.forEach(element => {
            const match = element.instructions ? element.instructions.match(/Comment Period on the (.*?) for /) : null;
            element.instructions = match ? match[1] : '';
          });
        }
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next(true);
    this.ngUnsubscribe.complete();
  }
}
