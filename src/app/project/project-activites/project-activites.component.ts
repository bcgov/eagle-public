import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { Subject } from 'rxjs';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { News } from 'app/models/news';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { SearchTerms, ISearchResults } from 'app/models/search';
import { Project } from 'app/models/project';
import { ActivitiesListTableRowsComponent } from './activities-list-table-rows/activities-list-table-rows.component';
import { Utils } from 'app/shared/utils/utils';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.scss']
})
export class ProjectActivitesComponent implements OnInit, OnDestroy {
  public terms = new SearchTerms();
  public recentActivities: Array<News> = [];
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public tableParams: TableParamsObject = new TableParamsObject();
  public loading = true;
  public currentProject;

  public tableData: TableObject;
  public tableColumns: any[] = [
    {
      name: 'Headline',
      value: 'headine',
      width: 'col-10',
      nosort: true
    },
    {
      name: 'Date',
      value: 'dateAdded',
      width: 'col-2',
      nosort: true
    }
  ];
  constructor(private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplateUtils,
    private utils: Utils,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {

    this.route.parent.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        (data: { project: Project }) => {
          const results = data ? data.project : null;
          if (results) {
            this.currentProject = results;
          } else {
            alert('Uh-oh, couldn\'t load project');
            // project not found --> navigate back to project list
            this.router.navigate(['/projects']);
          }
          this._changeDetectionRef.detectChanges();
        }
      );

    this.route.params
      .takeUntil(this.ngUnsubscribe)
      .subscribe(params => {
        this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params);
        if (this.tableParams.sortBy === '-datePosted') {
          this.tableParams.sortBy = '-dateAdded';
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, null, this.tableParams.keywords);
        }
        this._changeDetectionRef.detectChanges();

        this.route.data
          .takeUntil(this.ngUnsubscribe)
          // TODO: add in the proper type for documents here
          .subscribe((data: { documents: ISearchResults<News>[] }) => {
            const results = (data && data.documents) ?  this.utils.extractFromSearchResults(data.documents) : null;
            if (results) {
              if (data.documents && data.documents[0] && data.documents[0].data && data.documents[0].data.meta && data.documents[0].data.meta.length > 0) {
                this.tableParams.totalListItems = data.documents[0].data.meta[0].searchResultsTotal;
                this.recentActivities = data.documents[0].data.searchResults;
              } else {
                this.tableParams.totalListItems = 0;
                this.recentActivities = [];
              }
              this.setRowData();
              this.loading = false;
              this._changeDetectionRef.detectChanges();
            } else {
              alert('Uh-oh, couldn\'t load valued components');
              // project not found --> navigate back to search
              this.router.navigate(['/search']);
            }
          });
      });
  }
  setRowData() {
    let list = [];
    if (this.recentActivities && this.recentActivities.length > 0) {
      this.recentActivities.forEach(document => {
        list.push(
          document
        );
      });
      this.tableData = new TableObject(
        ActivitiesListTableRowsComponent,
        list,
        this.tableParams
      );
    }
  }


  setColumnSort(column) {
    if (this.tableParams.sortBy.charAt(0) === '+') {
      this.tableParams.sortBy = '-' + column;
    } else {
      this.tableParams.sortBy = '+' + column;
    }
    this.getPaginatedDocs(this.tableParams.currentPage);
  }

  getPaginatedDocs(pageNumber) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);

    const params = this.terms.getParams();
    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.tableParams.currentPage = pageNumber;
    params['sortBy'] = this.tableParams.sortBy = '-dateAdded';
    params['keywords'] = this.tableParams.keywords;
    params['pageSize'] = this.tableParams.pageSize = 10;

    this.router.navigate(['p', this.currentProject._id, 'project-details', params]);
  }

  public onSubmit() {
    // dismiss any open snackbar
    // if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    // NOTE: Angular Router doesn't reload page on same URL
    // REF: https://stackoverflow.com/questions/40983055/how-to-reload-the-current-route-with-the-angular-2-router
    // WORKAROUND: add timestamp to force URL to be different than last time

    const params = this.terms.getParams();
    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.tableParams.currentPage = 1;
    params['sortBy'] = this.tableParams.sortBy = '-dateAdded';
    params['keywords'] = this.tableParams.keywords;
    params['pageSize'] = this.tableParams.pageSize = 10;

    this.router.navigate(['p', this.currentProject._id, 'project-details', params]);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
