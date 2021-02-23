import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { SearchResults } from 'app/models/search';
import { PinsTableRowsComponent } from './pins-table-rows/pins-table-rows.component';
import { takeWhile } from 'rxjs/operators';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { PinsService } from 'app/services/pins.service';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';

@Component({
  selector: 'app-pins',
  templateUrl: './pins.component.html',
  styleUrls: ['./pins.component.scss']
})
export class PinsComponent implements OnInit, OnDestroy {
  private currentProject;
  private alive = true;
  public loading: Boolean = true;

  public tableData: TableObject2 = new TableObject2({ component: PinsTableRowsComponent });
  public tableColumns: any[] = [
    {
      name: 'Nation Name',
      value: 'name',
      width: 'col-8'
    },
    {
      name: 'Location',
      value: 'province',
      width: 'col-4'
    }
  ];
  constructor(
    private router: Router,
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplate,
    private pinsService: PinsService
  ) {
  }

  ngOnInit() {
    this.currentProject = this.storageService.state.currentProject.data;

    this.tableData.tableId = 'pins-table';

    // Hide table controls
    this.tableData.options.showPageCountDisplay = false;
    this.tableData.options.showPageSizePicker = false;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData, 'Pins');
      this.tableData.sortBy = data['params'].sortByPins ? data['params'].sortByPins : '+name';
      this._changeDetectionRef.detectChanges();
    });

    this.pinsService.getValue()
      .pipe(takeWhile(() => this.alive))
      .subscribe((searchResults: SearchResults) => {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        if (this.tableData.totalListItems > 0) {
          this.tableData.items = searchResults.data.map(record => {
            return { rowData: record };
          });
        } else {
          this.tableData.items = [];
        }

        this.tableData.columns = this.tableColumns;
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
    this.submit();
  }

  onPageNumUpdate(pageNumber) {
    this.tableData.currentPage = pageNumber;
    this.submit();
  }

  async submit() {
    const encodedParams = {
      currentPagePins: this.tableData.currentPage,
      pageSizePins: this.tableData.pageSize,
      sortByPins: this.tableData.sortBy,
    };

    this.router.navigate(
      ['../project-details'],
      {
        queryParams: encodedParams,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      }
    );

    await this.pinsService.fetchData(this.tableData.currentPage, this.tableData.pageSize, this.tableData.sortBy, this.currentProject._id);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
