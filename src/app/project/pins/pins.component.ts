import { Component, OnDestroy, inject, computed, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { takeWhile } from 'rxjs/operators';

import { StorageService } from 'app/services/storage.service';
import { SearchResults } from 'app/models/search';
import { PinsTableRowsComponent } from './pins-table-rows/pins-table-rows.component';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { PinsService } from 'app/services/pins.service';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { LoadingStateService } from 'app/services/loading-state.service';

@Component({
  selector: 'app-pins',
  templateUrl: './pins.component.html',
  imports: [TableTemplateComponent],
  standalone: true
})
export class PinsComponent implements OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private storageService = inject(StorageService);
  private tableTemplateUtils = inject(TableTemplate);
  private pinsService = inject(PinsService);
  private loadingState = inject(LoadingStateService);

  private alive = true;
  private projId = '';
  public loading = computed(() => 
    this.loadingState.getOperationState(`pins-${this.projId || 'all'}-page-${this.pinsService.fetchDataConfig.currentPage}`)()
  );

  public readonly tableColumns: any[] = [
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

  public tableData = signal<TableObject>(new TableObject({ component: PinsTableRowsComponent }));

  constructor() {
    const initialTableData = this.tableData();
    initialTableData.tableId = 'pins-table';
    initialTableData.options.showPageCountDisplay = false;
    initialTableData.options.showPageSizePicker = false;
    initialTableData.options.disableRowHighlight = true;
    this.tableData.set(initialTableData);

    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.pinsService.fetchDataConfig.projId = this.projId;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      // Get params from route, update table data immutably
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData(), 'Pins');
      updatedTableData.sortBy = params.sortByPins ? params.sortByPins : '+name';
      this.tableData.set(updatedTableData);
    });

    this.pinsService.getValue()
      .pipe(takeWhile(() => this.alive))
      .subscribe((searchResults: SearchResults) => {
        if (searchResults && searchResults.data !== null && searchResults.data !== undefined) {
          const currentData = this.tableData();
          const updatedTableData = { ...currentData };
          updatedTableData.totalListItems = searchResults.totalSearchCount || 0;
          if (Array.isArray(searchResults.data) && searchResults.data.length > 0) {
            updatedTableData.items = searchResults.data.map((record: any) => {
              return { rowData: record };
            });
          } else {
            updatedTableData.items = [];
          }
          updatedTableData.columns = this.tableColumns;
          this.tableData.set(updatedTableData);
        }
      });

    // Trigger initial data fetch
    this.pinsService.refreshData();
  }

  onMessageOut(msg: ITableMessage) {
    const params: any = {};
    switch (msg.label) {
      case 'columnSort': {
        const currentTableData = this.tableData();
        if (currentTableData.sortBy.charAt(0) === '+') {
          params['sortByPins'] = '-' + msg.data;
        } else {
          params['sortByPins'] = '+' + msg.data;
        }
        this.pinsService.fetchDataConfig.sortBy = params['sortByPins'];
        break;
      }
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
