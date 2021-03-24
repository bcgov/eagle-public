import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { SearchResults } from 'app/models/search';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { takeWhile } from 'rxjs/operators';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { DocumentService } from 'app/services/document.service';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.scss']
})
export class CertificatesComponent implements OnInit, OnDestroy {
  public tableParams: TableParamsObject = new TableParamsObject();
  public loading: Boolean = true;

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
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplate,
    private documentService: DocumentService,
  ) { }

  ngOnInit() {
    this.router.events.pipe(takeWhile(() => this.alive)).subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      const x = this.storageService.state.scrollPosition.data[0] ? this.storageService.state.scrollPosition.data[0] : 0;
      const y = this.storageService.state.scrollPosition.data[1] ? this.storageService.state.scrollPosition.data[1] : 0;
      if (x !== 0 || y !== 0) {
        window.scrollTo(x, y);
      }
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
    let params = {};
    switch (msg.label) {
      case 'columnSort':
        if (this.tableData.sortBy.charAt(0) === '+') {
          params['sortBy'] = '-' + msg.data;
        } else {
          params['sortBy'] = '+' + msg.data;
        }
        this.documentService.fetchDataConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.documentService.fetchDataConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loading = true;
        }
        params['currentPage'] = 1;
        this.documentService.fetchDataConfig.pageSize = params['pageSize'];
        this.documentService.fetchDataConfig.currentPage = params['currentPage'];

        this.storageService.state.scrollPosition = { type: 'scrollPosition', data: [window.scrollX, window.scrollY] };
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params, filters = null) {
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.documentService.refreshData();
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
