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
import { ISearchResults } from 'app/models/search';
import { Utils } from 'app/shared/utils/utils';
import { Org } from 'app/models/organization';
import { DataQueryResponse } from 'app/models/api-response';


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
    private utils: Utils,
    private searchService: SearchService,
    public configService: ConfigService,
    public projectService: ProjectService, // used in template
    public commentPeriodService: CommentPeriodService // used in template
  ) { }

  // add an entry to this.tabLinks if the corresponding documents have been tagged
  // tablink is the label/link pair to append to this.tabLinks
  // queryModifier is the queryModifier parameter of SearchService.getSearchResults
  private tabLinkIfNotEmpty(tabLink: {label: string, link: string}, queryModifier: object) {
    // attempt to get a single document that matches each query.
      this.searchService.getSearchResults(
        null,
        'Document',
        [{ 'name': 'project', 'value': this.project._id }],
        1,
        1,
        null,
        queryModifier,
        true,
        ''
      )
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        // add tab link if results are not empty
        if (res[0].data.searchResults.length) {
          if (!this.tabLinks.find(link => link.label === tabLink.label)) {
            this.tabLinks.push(tabLink);
          }
        }
      });
  }

  ngOnInit() {
    // get data from route resolver
    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        (data: { project: Project }) => {
          const results = data ?  data.project : null;
          if (results) {
            this.project = results;
            this.storageService.state.currentProject = { type: 'currentProject', data: this.project };
            this.renderer.removeClass(document.body, 'no-scroll');
            this._changeDetectionRef.detectChanges();
          } else {
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
        }
      );
    this.initTabLinks();

    if (this.project.legislation.includes('2002')) {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
    } else if  (this.project.legislation.includes('1996')) {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
    } else {
      this.legislationLink = Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK;
    }
  }

  initTabLinks(): void {
    // TODO: These IDs should not be hardcoded. Need to retrieve them from the list.
    const tabLinks = [
      {
        tab: {
          label: 'Certificate',
          link: 'certificates'
        },
        tabDisplayCriteria: Constants.tabModifier.CERTIFICATE
      },
      {
        tab: {
          label: 'Amendment(s)',
          link: 'amendments'
        },
        tabDisplayCriteria: Constants.tabModifier.AMENDMENT
      }
    ]

    tabLinks.forEach(tabLink => this.tabLinkIfNotEmpty(tabLink.tab, tabLink.tabDisplayCriteria));

    // Not documents so can't use the tabLinkIfNotEmpty()
    this.projectService.getPins(this.project._id, 1, 1, null)
      .takeUntil(this.ngUnsubscribe)
      .subscribe((response: DataQueryResponse<Org>[]) => {
        if (response && response.length && response[0].results && response[0].results.length && response[0].total_items) {
        this.tabLinks.push({ label: 'Participating Indigenous Nations', link: 'pins' });
    }})
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
