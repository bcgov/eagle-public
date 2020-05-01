import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';

import { Document } from 'app/models/document';
import { SearchTerms } from 'app/models/search';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { FilterObject } from 'app/shared/components/table-template/filter-object';
import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';

import { SearchService } from 'app/services/search.service';
import { StorageService } from 'app/services/storage.service';
import { Constants } from 'app/shared/utils/constants';

class DocumentFilterObject {
  constructor(
    public milestone: Array<string> = [],
    public datePostedStart: object = {},
    public datePostedEnd: object = {},
    public type: Array<string> = [],
    public projectPhase: Array<string> = [],
    public documentAuthorType: Array<string> = []
  ) { }
}

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  styleUrls: ['./documents-tab.component.scss']
})

export class DocumentsTabComponent implements OnInit, OnDestroy {
  public documents: Document[] = null;

  public loading = true;

  public tableParams: TableParamsObject = new TableParamsObject();
  public terms = new SearchTerms();

  public filterForAPI: object = {};
  public filterForUI: DocumentFilterObject = new DocumentFilterObject();

  public hasUncategorizedDocs = false;
  public readonly constants = Constants;

  public documentTableData: TableObject;

  public documentTableColumns: any[] = [
    {
      name: '★',
      value: 'isFeatured',
      width: 'col-1'
    },
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-3'
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

  public selectedCount = 0;
  public currentProject;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public filters: FilterObject[] = [];

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  private milestoneFilter = new FilterObject('milestone', 'Milestone', null, [], [], this.legislationFilterGroup);
  private docDateFilter = new FilterObject('datePosted', 'Document Date', { startDateId: 'datePostedStart', endDateId: 'datePostedEnd' }, [], [], this.legislationFilterGroup);
  private authorTypeFilter = new FilterObject('documentAuthorType', 'Document Author', null, [], [], this.legislationFilterGroup);
  private docTypeFilter = new FilterObject('type', 'Document Type', null, [], [], this.legislationFilterGroup);
  private projectPhaseFilter = new FilterObject('projectPhase', 'Project Phase', null, [], [], this.legislationFilterGroup);


  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplateUtils
  ) {
    this.documentTableData = new TableObject(
      DocumentTableRowsComponent,
      [],
      this.tableParams
    );

    // inject filters into table template
    this.filters.push(this.milestoneFilter);
    this.filters.push(this.docDateFilter);
    this.filters.push(this.authorTypeFilter);
    this.filters.push(this.docTypeFilter);
    this.filters.push(this.projectPhaseFilter);
  }

  ngOnInit() {
    let params = null;
    this.route.params
      .switchMap((res: any) => {
        params = { ...res };
        return this.route.data;
      })
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res) {
          // Get the lists first
          if (res.documentsTableRow && res.documentsTableRow.length > 0) {
            res.documentsTableRow[0].searchResults.map(item => {
              if (item.type === 'label') {
                this.milestoneFilter.options.push({ ...item });
              } else if (item.type === 'doctype') {
                this.docTypeFilter.options.push({ ...item });
              } else if (item.type === 'author') {
                this.authorTypeFilter.options.push({ ...item });
              } else if (item.type === 'projectPhase') {
                this.projectPhaseFilter.options.push({ ...item });
              }
            });

            // Sort by legislation.
            this.milestoneFilter.options = _.sortBy(this.milestoneFilter.options, ['legislation']);
            this.authorTypeFilter.options = _.sortBy(this.authorTypeFilter.options, ['legislation']);
            this.docTypeFilter.options = _.sortBy(this.docTypeFilter.options, ['legislation', 'listOrder']);
            this.projectPhaseFilter.options = _.sortBy(this.projectPhaseFilter.options, ['legislation']);
          }

          this.currentProject = this.storageService.state.currentProject.data;

          if (this.currentProject && this.storageService.state[this.currentProject._id]) {
            if (this.storageService.state[this.currentProject._id].filterForUI) {
              this.filterForUI = this.storageService.state[this.currentProject._id].filterForUI;
            }

            if (this.storageService.state[this.currentProject._id].tableParams) {
              this.tableParams = this.storageService.state[this.currentProject._id].tableParams;
            }
          }

          if (!this.tableParams) {
            this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, this.filterForAPI);
          }

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
          this._changeDetectionRef.detectChanges();
        }
      });

    this.currentProject = this.storageService.state.currentProject.data;

    if (!this.storageService.state[this.currentProject._id]) {
      this.storageService.state[this.currentProject._id] = {};
    }

    this.router.url.split(';').forEach(filterVal => {
      if (filterVal.split('=').length === 2) {
        let filterName = filterVal.split('=')[0];
        let val = filterVal.split('=')[1];
        if (val && val !== 'null' && val.length !== 0) {
          if (!['currentPage', 'pageSize', 'sortBy', 'ms', 'keywords'].includes(filterName)) {
            this.filterForAPI[filterName] = val;
          }
        }
      }
    });

    this.searchService.getSearchResults(
      '',
      'Document',
      [
        { name: 'project', value: this.currentProject._id },
        { name: 'categorized', value: false }
      ],
      this.storageService.state[this.currentProject._id].tableParams ? this.storageService.state[this.currentProject._id].tableParams.currentPage : 1,
      this.storageService.state[this.currentProject._id].tableParams ? this.storageService.state[this.currentProject._id].tableParams.pageSize : 10,
      this.storageService.state[this.currentProject._id].tableParams ? this.storageService.state[this.currentProject._id].tableParams.sortBy : '-datePosted',
      { documentSource: 'PROJECT' },
      true,
      null,
      this.filterForAPI,
      ''
    )
    .takeUntil(this.ngUnsubscribe)
    .subscribe((res: any) => {
      if (res[0].data.meta && res[0].data.meta.length > 0) {
        this.hasUncategorizedDocs = true;
        this.loading = false;
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  setDocumentRowData() {
    let documentList = [];
    if (this.documents && this.documents.length > 0) {
      this.documents.forEach(document => {
        if (document) {
          documentList.push(
            {
              documentFileName: document.documentFileName || document.displayName || document.internalOriginalName,
              // date: document.dateUploaded || document.datePosted,
              displayName: document.displayName,
              datePosted: document.datePosted,
              type: document.type,
              milestone: document.milestone,
              _id: document._id,
              project: document.project,
              isFeatured: document.isFeatured,
              projectPhase: document.projectPhase
            }
          );
        }
      });
    }
    this.documentTableData = new TableObject(
      DocumentTableRowsComponent,
      documentList,
      this.tableParams
    );
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

  executeSearch(apiFilters) {
    this.terms.keywords = apiFilters.keywords;
    this.tableParams.keywords = apiFilters.keywords;
    this.filterForAPI = apiFilters.filterForAPI;

    this.filterForUI.milestone = this.filterForAPI['milestone'] ? this.filterForAPI['milestone'].split(',') : null;
    this.filterForUI.documentAuthorType = this.filterForAPI['documentAuthorType'] ? this.filterForAPI['documentAuthorType'].split(',') : null;
    this.filterForUI.type = this.filterForAPI['type'] ? this.filterForAPI['type'].split(',') : null;
    this.filterForUI.projectPhase = this.filterForAPI['projectPhase'] ? this.filterForAPI['projectPhase'].split(',') : null;
    this.filterForUI.datePostedStart = this.filterForAPI['datePostedStart'];
    this.filterForUI.datePostedEnd = this.filterForAPI['datePostedEnd'];

    this.getPaginatedDocs(this.tableParams.currentPage);
  }

  getPaginatedDocs(pageNumber) {
    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, this.tableParams.sortBy);

    // Filters and params are not set when paging
    // We don't need to redo everything, but we will
    // need to fetch the dates
    const params = this.terms.getParams();

    const datePostedStart = params.hasOwnProperty('datePostedStart') && params.datePostedStart ? params.datePostedStart : null;
    const datePostedEnd = params.hasOwnProperty('datePostedEnd') && params.datePostedEnd ? params.datePostedEnd : null;

    let queryModifiers = { documentSource: 'PROJECT' };

    if (datePostedStart !== null && datePostedEnd !== null) {
      queryModifiers['datePostedStart'] = datePostedStart;
      queryModifiers['datePostedEnd'] = datePostedEnd;
    }

    if (this.storageService) {
      this.storageService.state[this.currentProject._id].tableParams = this.tableParams;
    }

    this.searchService.getSearchResults(
      this.tableParams.keywords,
      'Document',
      [{ 'name': 'project', 'value': this.currentProject._id }],
      pageNumber,
      this.tableParams.pageSize,
      this.tableParams.sortBy,
      queryModifiers,
      true,
      null,
      this.filterForAPI,
      '')
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res[0].data && res[0].data.meta[0]) {
          this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
          this.documents = res[0].data.searchResults;
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, this.filterForAPI, this.tableParams.keywords);
        } else {
          this.documents = [];
          this.tableParams.totalListItems = 0;
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, this.filterForAPI, this.tableParams.keywords);
        }

        this.setDocumentRowData();
        this._changeDetectionRef.detectChanges();
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
