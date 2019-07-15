import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { ApiService } from 'app/services/api';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService } from 'app/services/search.service';
import { StorageService } from 'app/services/storage.service';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { Subject } from 'rxjs';
import { SearchTerms } from 'app/models/search';
import { PlatformLocation } from '@angular/common';
import { PinsTableRowsComponent } from './pins-table-rows/pins-table-rows.component';

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
      name: 'Province',
      value: 'province',
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
    private api: ApiService,
    private platformLocation: PlatformLocation,
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplateUtils
  ) {
    try {
      let currRoute = router.url.split(';')[0];
    } catch (e) {
      console.log('e:', e);
    }
  }

  ngOnInit() {
    this.route.params
      .takeUntil(this.ngUnsubscribe)
      .subscribe(params => {
        // Different sort order:
        this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, null, '+name');
      });

    this.currentProject = this.storageService.state.currentProject.data;

    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res) {
          if (res.pins && res.pins.length > 0) {
            this.tableParams.totalListItems = res.pins.length;
            this.pins = res.pins;
          } else {
            this.tableParams.totalListItems = 0;
            this.pins = [];
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
    if (this.pins && this.pins.length > 0) {
      this.pins.forEach(contact => {
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
    if (this.typeFilters.length > 0) { params['type'] = this.typeFilters.toString(); }

    this.router.navigate(['p', this.currentProject._id, 'pins', params]);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
