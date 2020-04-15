import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { Subject } from 'rxjs';
import { ConfigService } from 'app/services/config.service';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { SearchService } from 'app/services/search.service';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { Document } from 'app/models/document';

@Component({
  selector: 'app-project-details-tab',
  templateUrl: './project-details-tab.component.html',
  styleUrls: ['./project-details-tab-sm.component.scss', './project-details-tab-md-lg.component.scss'],
})
export class ProjectDetailsTabComponent implements OnInit {
  public project;
  public commentPeriod = null;
  public selectedCount = 0;
  public loading = true;
  public featuredDocuments: Document[] = null;
  public documentTableData: TableObject;
  public tableParams: TableParamsObject = new TableParamsObject();
  public lists: any[] = [];
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

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private storageService: StorageService,
    public configService: ConfigService,
    private tableTemplateUtils: TableTemplateUtils,
    private searchService: SearchService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.project = this.storageService.state.currentProject.data;
    this.commentPeriod = this.project.commentPeriodForBanner;
    this.route.params
    .subscribe(() => {
      this.getFavoriteDocs();
    });
  }
  // Featured Documents table addition

  getFavoriteDocs() {
    // Go to top of page after clicking to a different page.
    this.loading = true;

    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, 1, this.tableParams.sortBy);

    this.searchService.getFullList('List')
        .takeUntil(this.ngUnsubscribe)
        .subscribe((listRes: any) => {

          this.lists = listRes[0].searchResults;

          this.searchService.getSearchResults(
            this.tableParams.keywords,
            'Document',
            [{ 'name': 'project', 'value': this.project._id }],
            1,
            this.tableParams.pageSize,
            this.tableParams.sortBy,
            { documentSource: 'PROJECT', isFeatured: 'true' },
            true,
            null,
            {},
            '')
            .takeUntil(this.ngUnsubscribe)
            .subscribe((res: any) => {
              this.tableParams.totalListItems = res[0].data.searchResults.length;
              this.featuredDocuments = res[0].data.searchResults;
              this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, null, this.tableParams.keywords);
              this.setDocumentRowData();
              this.loading = false;
              this._changeDetectionRef.detectChanges();
            });
        });
  }

  updateSelectedRow(count) {
    this.selectedCount = count;
  }

  setColumnSort(column) {
    if (this.tableParams.sortBy.charAt(0) === '+') {
      this.tableParams.sortBy = '-' + column;
    } else {
      this.tableParams.sortBy = '+' + column;
    }
    this.getFavoriteDocs();
  }

  setDocumentRowData() {
    let documentList = [];
    if (this.featuredDocuments && this.featuredDocuments.length > 0) {
      this.featuredDocuments.forEach(document => {
        if (document) {
          documentList.push(
            {
              documentFileName: document.documentFileName || document.displayName || document.internalOriginalName,
              displayName: document.displayName,
              datePosted: document.datePosted,
              type: document.type,
              milestone: document.milestone,
              _id: document._id,
              project: document.project,
              isFeatured: document.isFeatured,
              typeString: this.idToList(document.type),
              milestoneString: this.idToList(document.milestone),
              projectPhase: this.idToList(document.projectPhase)
            }
          );
        }
      });

      this.documentTableData = new TableObject(
        DocumentTableRowsComponent,
        documentList,
        this.tableParams
      );
    }
  }

  idToList(id: string) {
    if (!id) {
      return '-';
    }
    // Grab the item from the constant lists, returning the name field of the object.
    let item = this.lists.filter(listItem => listItem._id === id);
    if (item.length !== 0) {
      return item[0].name;
    } else {
      return '-';
    }
  }
}
