import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { SearchResults } from 'app/models/search';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { takeWhile } from 'rxjs/operators';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { IPageSizePickerOption } from 'app/shared/components/page-size-picker/page-size-picker.component';
import { DocumentService } from 'app/services/document.service';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { Constants } from 'app/shared/utils/constants';
import { Utils } from 'app/shared/utils/utils';
import { ConfigService } from 'app/services/config.service';
import { SearchParamObject } from 'app/services/search.service';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.scss']
})
export class CertificatesComponent implements OnInit, OnDestroy {
  public tableParams: TableParamsObject = new TableParamsObject();
  public currentProject;
  public loading: Boolean = true;

  private lists: any[] = [];
  private alive = true;

  public tableData: TableObject2 = new TableObject2({ component: DocumentTableRowsComponent });
  public tableColumns: IColumnObject[] = [
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
      value: 'projectPhase',
      width: 'col-2'
    }
  ];
  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplate,
    private documentService: DocumentService,
    private utils: Utils,
    private configService: ConfigService
  ) { }

  ngOnInit() {
    this.currentProject = this.storageService.state.currentProject.data;

    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists = list;
      this._changeDetectionRef.detectChanges();
    });


    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData);
      this._changeDetectionRef.detectChanges();
    });

    this.documentService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        record.showFeatured = false;
        return { rowData: record };
      });
      this.tableData.columns = this.tableColumns;
      this.tableData.options.showAllPicker = true;

      this.loading = false;
      this._changeDetectionRef.detectChanges();
    });
  }

  onMessageOut(msg: ITableMessage) {
    switch (msg.label) {
      case 'columnSort':
        this.setColumnSort(msg.data);
        break;
      case 'pageNum':
        this.onPageNumUpdate(msg.data);
        break;
      case 'pageSize':
        this.onPageSizeUpdate(msg.data);
        break;
      default:
        break;
    }
  }

  setColumnSort(column) {
    if (this.tableData.sortBy.charAt(0) === '+') {
      this.tableData.sortBy = '-' + column;
    } else {
      this.tableData.sortBy = '+' + column;
    }
    this.tableData.currentPage = 1;
    this.submit();
  }

  onPageNumUpdate(pageNumber) {
    this.tableData.currentPage = pageNumber;
    this.submit();
  }

  onPageSizeUpdate(pageSize: IPageSizePickerOption) {
    this.tableData.pageSize = pageSize.value;
    if (this.tableData.pageSize === this.tableData.totalListItems) {
      this.loading = true;
    }
    this.tableData.currentPage = 1;
    this.submit();
  }

  async submit() {
    const params = this.tableTemplateUtils.getNavParamsObj(this.tableData);

    this.location.replaceState(
      this.router.serializeUrl(
        this.router.createUrlTree(
          ['../certificate'],
          {
            queryParams: params,
            relativeTo: this.route,
            queryParamsHandling: 'merge',
          })
      )
    );
    await this.documentService.fetchData(new SearchParamObject(
      '',
      'Document',
      [{ 'name': 'project', 'value': this.currentProject._id }],
      this.tableData.currentPage,
      this.tableData.pageSize,
      this.tableData.sortBy,
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.CERTIFICATE, this.lists)
    ));
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
