import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { ActivatedRoute } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { Subject } from 'rxjs';
import { SearchTerms } from 'app/models/search';
import { PinsTableRowsComponent } from './pins-table-rows/pins-table-rows.component';
import { Org } from 'app/models/organization';
import { ProjectService } from 'app/services/project.service';
import { DataQueryResponse } from 'app/models/api-response';

@Component({
  selector: 'app-pins',
  templateUrl: './pins.component.html',
  styleUrls: ['./pins.component.scss']
})
export class PinsComponent implements OnInit, OnDestroy {
  public pins = [];
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public tableData: TableObject;
  public tableParams: TableParamsObject = new TableParamsObject();
  public currentProject;
  public typeFilters = [];
  public terms = new SearchTerms();
  public loading: Boolean = true;
  public tableColumns: any[] = [
    {
      name: 'Nation Name',
      value: 'name',
      width: 'col-8'
    },
    {
      name: 'Location',
      value: 'location',
      width: 'col-4'
    }
    // {
    //   name: 'Link to Nation Information',
    //   value: 'link',
    //   width: 'col-3'
    // }
  ];
  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplateUtils,
    private projectService: ProjectService
  ) {
  }

  ngOnInit() {
    this.route.params
    .takeUntil(this.ngUnsubscribe)
    .subscribe(params => {
      // Different sort order:
      this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, null, '+name');
      this.tableParams.pageSize = 5;
    });

    this.currentProject = this.storageService.state.currentProject.data;

    this.projectService.getPins(this.currentProject._id, 1, 5, '+name')
    .takeUntil(this.ngUnsubscribe)
    .subscribe((res: DataQueryResponse<Org>[]) => {
      if (res && res.length && res[0].results && res[0].results.length && res[0].total_items) {
        if (res[0].results && res[0].results.length > 0) {
          this.tableParams.totalListItems = res[0].total_items.valueOf();
          this.pins = res;
        } else {
          this.tableParams.totalListItems = 0;
          this.pins = [];
        }
        this.loading = false;
        this.setDocumentRowData();
        this._changeDetectionRef.detectChanges();
      }
    });
  }


  setDocumentRowData() {
    let documentList = [];
    if (this.pins && this.pins.length > 0 && this.pins[0].results) {
      this.pins[0].results.forEach(contact => {
        documentList.push(contact);
      });
      this.tableData = new TableObject(
        PinsTableRowsComponent,
        documentList,
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
    this.getPaginated(this.tableParams.currentPage);
  }

  getPaginated(pageNumber, reset = false) {
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
    if (this.typeFilters.length > 0) { params['type'] = this.typeFilters.toString(); }

    this.projectService.getPins(this.currentProject._id, 1, this.tableParams.pageSize, this.tableParams.sortBy)
    .takeUntil(this.ngUnsubscribe)
    .subscribe((res: DataQueryResponse<Org>[]) => {
      if (res && res.length && res[0].results && res[0].results.length && res[0].total_items) {
        if (res[0].results && res[0].results.length > 0) {
          this.tableParams.totalListItems = res[0].total_items.valueOf();
          this.pins = res;
        } else {
          this.tableParams.totalListItems = 0;
          this.pins = [];
        }
        this.loading = false;
        this.setDocumentRowData();
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
