import { Component, OnInit, Renderer2, ChangeDetectorRef, OnDestroy } from '@angular/core';
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
import { Constants } from 'app/shared/utils/constants';
import { SearchService } from 'app/services/search.service';

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.scss']
})
export class ProjectComponent implements OnInit, OnDestroy {
  public tabLinks = [
    { label: 'Project Details', link: 'project-details' },
    { label: 'Commenting', link: 'commenting' },
    { label: 'Documents', link: 'documents' },
    // { label: 'Certificate', link: 'certificates' },
    // { label: 'Amendment(s)', link: 'amendments' },
    // { label: 'Participating Indigenous Nations', link: 'pins' }
  ];

  public project: Project = null;
  public period: CommentPeriod = null;
  private ngbModal: NgbModalRef = null;
  public legislationLink: String = '';
  private certTagsExist: boolean;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private router: Router,
    private modalService: NgbModal,
    private _changeDetectionRef: ChangeDetectorRef,
    private renderer: Renderer2,
    private searchService: SearchService,
    public configService: ConfigService,
    public projectService: ProjectService, // used in template
    public commentPeriodService: CommentPeriodService // used in template
  ) { }

  // add an entry to this.tabLinks if the corresponding documents have been tagged
  // tablink is the label/link pair to append to this.tabLinks
  // queryModifier is the queryModifier parameter of SearchService.getSearchResults
  private tabLinkIfNotEmpty(tabLink: {label: string, link: string}, queryModifier: object) {
    // attempt to get a single document that matches the query
    this.searchService.getSearchResults(
      null,
      'Document',
      [{ 'name': 'project', 'value': this.project._id }],
      1,
      1,
      null,
      queryModifier,
      true)
        .takeUntil(this.ngUnsubscribe)
          .subscribe((res: any) => {
            // add tab link if results are not empty
            if (res[0].data.searchResults.length) {
              this.tabLinks.push(tabLink);
            }
          })
  }


  ngOnInit() {
    // get data from route resolver
    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        (data: { project: Project }) => {
          if (data.project) {
            this.project = data.project;
            this.storageService.state.currentProject = { type: 'currentProject', data: this.project };
            this.renderer.removeClass(document.body, 'no-scroll');
            this.project = data.project;
            this._changeDetectionRef.detectChanges();
          } else {
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );
      this.tabLinkIfNotEmpty({ label: 'Certificate', link: 'certificates' },
      {
        // Search only Certificate Package/EAO/Certificate
        documentSource: 'PROJECT',
        type: '5cf00c03a266b7e1877504d5',
        documentAuthorType: '5cf00c03a266b7e1877504db',
        milestone: '5cf00c03a266b7e1877504eb'
      }
    );
      this.tabLinkIfNotEmpty({ label: 'Amendment(s)', link: 'amendments' },
        {
          // Search only Amendment Package/Amendment
          documentSource: 'PROJECT',
          type: '5cf00c03a266b7e1877504d7',
          milestone: '5cf00c03a266b7e1877504f2'
        }
      );
      if (this.project.legislation.includes('2002')) {
        this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
      } else {
        this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
      }
  }

  public addComment() {
    if (this.project.commentPeriodForBanner) {
      // open modal
      this.ngbModal = this.modalService.open(AddCommentComponent, { backdrop: 'static', size: 'lg' });
      // set input parameter
      (<AddCommentComponent>this.ngbModal.componentInstance).currentPeriod = this.project.commentPeriodForBanner;
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

  public goToViewComments() {
    this.router.navigate(['/p', this.project._id, 'cp', this.project.commentPeriodForBanner._id, 'details']);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
