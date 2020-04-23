import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { Subject } from 'rxjs';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { SearchTerms } from 'app/models/search';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.scss']
})
export class CertificatesComponent implements OnInit, OnDestroy {
  public documents = [];
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public documentTableData: TableObject;
  public tableParams: TableParamsObject = new TableParamsObject();
  public currentProject;
  public typeFilters = [];
  public terms = new SearchTerms();
  public loading: Boolean = true;
  public currentUrl: String = '';
  public documentTableColumns: any[] = [
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-4'
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-2'
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2'
    },
    {
      name: 'Milestone',
      value: 'milestone',
      width: 'col-2'
    },
    {
      name: 'Phase',
      value: 'phase',
      width: 'col-2'
    }
  ];
  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplateUtils
  ) {
    try {
      let currRoute = router.url.split(';')[0];
      this.currentUrl = currRoute.substring(currRoute.lastIndexOf('/') + 1);
    } catch (e) {
      console.log('e:', e);
    }
  }

  ngOnInit() {
    this.route.params
      .takeUntil(this.ngUnsubscribe)
      .subscribe(params => {
        if (this.currentUrl === 'amendments') {
          this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params);
        } else if (this.currentUrl === 'application') {
          this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, null, '+sortOrder,-datePosted,+displayName');
        } else {
          // Different sort order:
          this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, null, '+displayName');
        }
      });

    this.currentProject = this.storageService.state.currentProject.data;

    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res) {
          if (res.documents && res.documents[0].data.meta && res.documents[0].data.meta.length > 0) {
            this.tableParams.totalListItems = res.documents[0].data.meta[0].searchResultsTotal;
            this.documents = res.documents[0].data.searchResults;
          } else {
            this.tableParams.totalListItems = 0;
            this.documents = [];
          }
          this.loading = false;
          this.setDocumentRowData();
          this._changeDetectionRef.detectChanges();
        } else {
          alert('Uh-oh, couldn\'t load valued components');
          // project not found --> navigate back to search
          this.router.navigate(['/search']);
          this.loading = false;
        }
      }
      );
  }

  setDocumentRowData() {
    let documentList = [];
    if (this.documents && this.documents.length > 0) {
      this.documents.forEach(document => {
        documentList.push(
          {
            _id: document._id,
            documentFileName: document.documentFileName || document.displayName || document.internalOriginalName,
            displayName: document.displayName,
            datePosted: document.datePosted,
            type: document.type,
            milestone: document.milestone,
            project: document.project,
            projectPhase: document.projectPhase
          }
        );
      });
      this.documentTableData = new TableObject(
        DocumentTableRowsComponent,
        documentList,
        this.tableParams,
        { showFeatured: false },
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

  getPaginatedDocs(pageNumber, reset = false) {
    // Go to top of page after clicking to a different page.
    this.loading = true;
    this._changeDetectionRef.detectChanges();

    const params = this.terms.getParams();
    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.tableParams.currentPage = pageNumber;

    if (reset) {
      this.tableParams.sortBy = '';
      this.tableParams.pageSize = 10;
      this.tableParams.keywords = '';
      this.typeFilters = [];
    }

    params['sortBy'] = this.tableParams.sortBy;
    params['pageSize'] = this.tableParams.pageSize;
    params['keywords'] = this.tableParams.keywords;
    // params['dateAddedStart'] = this.utils.convertFormGroupNGBDateToJSDate(this.filter.dateAddedStart).toISOString();
    // params['dateAddedEnd'] = this.utils.convertFormGroupNGBDateToJSDate(this.filter.dateAddedEnd).toISOString();
    if (this.typeFilters.length > 0) { params['type'] = this.typeFilters.toString(); }

    if (this.currentUrl === 'amendments') {
      this.router.navigate(['p', this.currentProject._id, 'amendments', params]);
    } else if (this.currentUrl === 'application') {
      this.router.navigate(['p', this.currentProject._id, 'application', params]);
    } else {
      this.router.navigate(['p', this.currentProject._id, 'certificates', params]);
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
