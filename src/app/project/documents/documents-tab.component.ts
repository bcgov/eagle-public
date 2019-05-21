import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { DialogService } from 'ng2-bootstrap-modal';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';

import { Document } from 'app/models/document';
import { SearchTerms, SearchResults } from 'app/models/search';

import { ApiService } from 'app/services/api';
import { DocumentService } from 'app/services/document.service';
import { SearchService } from 'app/services/search.service';
import { StorageService } from 'app/services/storage.service';

import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';


@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  styleUrls: ['./documents-tab.component.scss']
})
export class DocumentsTabComponent implements OnInit, OnDestroy {
  public terms = new SearchTerms();
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public documents: Document[] = null;
  public loading = true;

  public documentTableData: TableObject;
  public documentTableColumns: any[] = [
    // {
    //   name: '',
    //   value: 'check',
    //   width: 'col-1'
    // },
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-6'
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
    }
  ];

  public selectedCount = 0;
  public keywords = '';

  public currentProject;

  public tableParams: TableParamsObject = new TableParamsObject();

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private api: ApiService,
    private dialogService: DialogService,
    private documentService: DocumentService,
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplateUtils
  ) { }

  ngOnInit() {
    // get data from route resolver

    this.route.params
      .takeUntil(this.ngUnsubscribe)
      .subscribe(params => {
        this.keywords = params.keywords;
        this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params);
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

  public selectAction(action) {
    // select all documents
    switch (action) {
      case 'copyLink':
        this.documentTableData.data.map((item) => {
          if (item.checkbox === true) {
            let selBox = document.createElement('textarea');
            selBox.style.position = 'fixed';
            selBox.style.left = '0';
            selBox.style.top = '0';
            selBox.style.opacity = '0';
            selBox.value = window.location.href.split(';')[0] + `/detail/${item._id}`;
            document.body.appendChild(selBox);
            selBox.focus();
            selBox.select();
            document.execCommand('copy');
            document.body.removeChild(selBox);
          }
        });
        break;
      case 'selectAll':
        let someSelected = false;
        this.documentTableData.data.map((item) => {
          if (item.checkbox === true) {
            someSelected = true;
          }
        });
        this.documentTableData.data.map((item) => {
          item.checkbox = !someSelected;
        });

        this.selectedCount = someSelected ? 0 : this.documentTableData.data.length;
        this._changeDetectionRef.detectChanges();
        break;
      case 'download':
        let promises = [];
        this.documentTableData.data.map((item) => {
          if (item.checkbox === true) {
            promises.push(this.api.downloadDocument(this.documents.filter(d => d._id === item._id)[0]));
          }
        });
        return Promise.all(promises).then(() => {
          console.log('Download initiated for file(s)');
        });
    }
  }

  setDocumentRowData() {
    let documentList = [];
    if (this.documents && this.documents.length > 0) {
      this.documents.forEach(document => {
        documentList.push(
          {
            // displayName: document.displayName || document.internalOriginalName,
            // date: document.dateUploaded || document.datePosted,
            displayName: document.displayName,
            datePosted: document.datePosted,
            type: document.type,
            milestone: document.milestone,
            _id: document._id,
            project: document.project
          }
        );
      });
      this.documentTableData = new TableObject(
        DocumentTableRowsComponent,
        documentList,
        this.tableParams
      );
    }
  }

  setColumnSort(column) {
    this.tableParams.sortBy = column;
    this.tableParams.sortDirection = this.tableParams.sortDirection > 0 ? -1 : 1;
    this.getPaginatedDocs(this.tableParams.currentPage, this.tableParams.sortBy, this.tableParams.sortDirection);
  }

  isEnabled(button) {
    switch (button) {
      case 'copyLink':
        return this.selectedCount === 1;
      default:
        return this.selectedCount > 0;
    }
  }

  updateSelectedRow(count) {
    this.selectedCount = count;
  }

  getPaginatedDocs(pageNumber, newSortBy, newSortDirection) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);
    this.loading = true;

    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, newSortBy, newSortDirection);

    this.searchService.getSearchResults(
      this.keywords,
      'Document',
      [{ 'name': 'project', 'value': this.currentProject._id }],
      pageNumber,
      this.tableParams.pageSize,
      this.tableParams.sortString,
      '[documentSource]=PROJECT',
      true)
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
        this.documents = res[0].data.searchResults;
        this.tableTemplateUtils.updateUrl(this.tableParams.sortString, this.tableParams.currentPage, this.tableParams.pageSize);
        this.setDocumentRowData();
        this.loading = false;
        this._changeDetectionRef.detectChanges();
      });
  }

  public onSubmit() {
    // dismiss any open snackbar
    // if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    // NOTE: Angular Router doesn't reload page on same URL
    // REF: https://stackoverflow.com/questions/40983055/how-to-reload-the-current-route-with-the-angular-2-router
    // WORKAROUND: add timestamp to force URL to be different than last time

    // Reset page.
    this.tableParams.currentPage = 1;
    this.tableParams.sortBy = '';
    this.tableParams.sortDirection = 0;

    const params = this.terms.getParams();
    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.tableParams.currentPage;
    params['sortBy'] = this.tableParams.sortBy;
    params['sortDirection'] = this.tableParams.sortDirection;


    console.log('params =', params);
    console.log('nav:', ['p', this.currentProject._id, 'documents', params]);
    this.router.navigate(['p', this.currentProject._id, 'documents', params]);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

}
