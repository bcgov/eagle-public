import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeWhile } from 'rxjs/operators';

import { StorageService } from 'app/services/storage.service';
import { SearchResults } from 'app/models/search';
import { PinsTableRowsComponent } from './pins-table-rows/pins-table-rows.component';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { PinsService } from 'app/services/pins.service';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';

@Component({
  selector: 'app-pins',
  templateUrl: './pins.component.html',
  styleUrls: ['./pins.component.css'],
  imports: [CommonModule, TableTemplateComponent],
  standalone: true
})
export class PinsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private _changeDetectionRef = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private tableTemplateUtils = inject(TableTemplate);
  private pinsService = inject(PinsService);

  private alive = true;
  public loading = true;

  public tableData: TableObject = new TableObject({ component: PinsTableRowsComponent });
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

  ngOnInit() {
    this.tableData.tableId = 'pins-table';

    // Hide table controls
    this.tableData.options.showPageCountDisplay = false;
    this.tableData.options.showPageSizePicker = false;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData, 'Pins');
      this.tableData.sortBy = params.sortByPins ? params.sortByPins : '+name';
      this._changeDetectionRef.detectChanges();
    });

    this.pinsService.getValue()
      .pipe(takeWhile(() => this.alive))
      .subscribe((searchResults: SearchResults) => {
        if (searchResults.data !== 0) {
          this.tableData.totalListItems = searchResults.totalSearchCount;
          if (this.tableData.totalListItems > 0) {
            this.tableData.items = searchResults.data.map((record: any) => {
              return { rowData: record };
            });
          } else {
            this.tableData.items = [];
          }
          this.tableData.columns = this.tableColumns;

          this.loading = false;
          this._changeDetectionRef.detectChanges();
        }
      });
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    switch (msg.label) {
      case 'columnSort':
        if (this.tableData.sortBy.charAt(0) === '+') {
          params['sortByPins'] = '-' + msg.data;
        } else {
          params['sortByPins'] = '+' + msg.data;
        }
        this.pinsService.fetchDataConfig.sortBy = params['sortByPins'];
        break;
      case 'pageNum':
        params['currentPagePins'] = msg.data;
        this.pinsService.fetchDataConfig.currentPage = params['currentPagePins'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params: any) {
    this.storageService.state.scrollPosition = { type: 'scrollPosition', data: [window.scrollX, window.scrollY] };
    this.router.navigate(
      [],
      {
        queryParams: params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.pinsService.refreshData();
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
