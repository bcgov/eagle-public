import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, Renderer2, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/takeUntil';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

import { Project } from 'app/models/project';
import { ConfigService } from 'app/services/config.service';
import { ProjectService } from 'app/services/project.service';
import { CommentPeriodService } from 'app/services/commentperiod.service';
import { StorageService } from 'app/services/storage.service';
import { CommentPeriod } from 'app/models/commentperiod';
import { AddCommentComponent } from './comments/add-comment/add-comment.component';

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.scss']
})
export class ProjectComponent implements OnInit {
  readonly tabLinks = [
    { label: 'Project Details', link: 'project-details' },
    { label: 'Commenting', link: 'commenting' },
    { label: 'Documents', link: 'documents' }
  ];

  public project: Project = null;
  public period: CommentPeriod = null;
  private ngbModal: NgbModalRef = null;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private router: Router,
    private modalService: NgbModal,
    private _changeDetectionRef: ChangeDetectorRef,
    private renderer: Renderer2,
    public configService: ConfigService,
    public projectService: ProjectService, // used in template
    public commentPeriodService: CommentPeriodService // used in template
  ) { }

  ngOnInit() {
    // get data from route resolver
    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        (data: { project: Project }) => {
          if (data.project) {
            this.storageService.state.currentProject = { type: 'currentProject', data: data.project };
            this.renderer.removeClass(document.body, 'no-scroll');
            this.project = data.project;

            // ***************************************************
            // TODO Resolve this period from the actual project.
            // Open
            // this.period = new CommentPeriod({
            //   _id: '5980d4f8436253001dcaf8b8',
            //   informationLabel: 'Lorem Ipsum',
            //   dateStarted: '2019-01-17 22:03:52.162Z',
            //   dateCompleted: '2019-12-01 19:25:37.113Z'
            // });
            // // Closed
            // this.period = new CommentPeriod({
            //   _id: '5980d4f8436253001dcaf8b8',
            //   informationLabel: 'Lorem Ipsum',
            //   dateStarted: '2019-01-17 22:03:52.162Z',
            //   dateCompleted: '2019-02-01 19:25:37.113Z'
            // });
            // Scheduled shouldn't show because non 7 day window
            // this.period = new CommentPeriod({
            //   _id: '5980d4f8436253001dcaf8b8',
            //   informationLabel: 'Lorem Ipsum',
            //   dateStarted: '2019-12-17 22:03:52.162Z',
            //   dateCompleted: '2019-12-22 19:25:37.113Z'
            // });
            // Scheduled fix this to be within 7 days of coding test
            // this.period = new CommentPeriod({
            //   _id: '5980d4f8436253001dcaf8b8',
            //   informationLabel: 'Lorem Ipsum',
            //   dateStarted: '2019-05-17 22:03:52.162Z',
            //   dateCompleted: '2019-05-18 19:25:37.113Z'
            // });
            console.log('period:', this.period);
            this._changeDetectionRef.detectChanges();
          } else {
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );
  }

  public addComment() {
    if (this.project.upcomingCommentPeriod) {
      // open modal
      this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
      // set input parameter
      (<AddCommentComponent>this.ngbModal.componentInstance).currentPeriod = this.project.upcomingCommentPeriod;
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
}
