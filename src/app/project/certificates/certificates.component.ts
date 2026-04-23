import { Component, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { takeWhile, take, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { LoadingStateService } from '../../services/loading-state.service';
import { ConfigService } from '../../services/config.service';
import { Utils } from '../../shared/utils/utils';
import { Constants } from '../../shared/utils/constants';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  imports: [TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class CertificatesComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableTemplateUtils = inject(TableTemplate);
  private readonly tableService = inject(TableService);
  private readonly loadingState = inject(LoadingStateService);
  private readonly configService = inject(ConfigService);
  private readonly utils = inject(Utils);

  private readonly tableId = 'certificates';
  private alive = true;
  private projId = '';
  private lists: any[] = [];

  public readonly loading = this.loadingState.getOperationState('table-certificates');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));
  private readonly tableSignal$ = toObservable(this.tableService.getTableSignal(this.tableId));

  constructor() {
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.tableService.clearTable(this.tableId);

    // Watch for table data changes from service
    this.tableSignal$.pipe(takeWhile(() => this.alive)).subscribe(searchResults => {
      
      if (searchResults && searchResults.data) {
        const currentTableData = this.tableData();
        const newTableData = new TableObject({
          component: DocumentTableRowsComponent,
          pageSize: currentTableData.pageSize,
          currentPage: currentTableData.currentPage,
          sortBy: currentTableData.sortBy
        });

        newTableData.totalListItems = searchResults.totalSearchCount;
        newTableData.items = searchResults.data.map((record: any) => {
          record.showFeatured = false;
          return { rowData: record };
        });
        newTableData.columns = this.tableColumns;
        newTableData.options.showAllPicker = true;

        this.tableData.set(newTableData);
      }
    });

    // Wait for lists metadata before subscribing to query params.
    // This prevents a premature fetch with empty lists (wrong modifiers) followed
    // by a second fetch once lists arrive — the source of the pop-in.
    this.configService.lists.pipe(
      take(1),
      switchMap(list => {
        this.lists = list;
        return this.route.queryParamMap;
      }),
      takeWhile(() => this.alive)
    ).subscribe(() => {
      this.fetchDataWithCurrentParams();
    });
  }

  public readonly tableColumns: IColumnObject[] = [
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

  private fetchDataWithCurrentParams() {
    const currentParams = this.route.snapshot.queryParamMap;
    const queryParams = { ...(currentParams as any)['params'] };
    
    const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(
      queryParams,
      this.tableData()
    );
    
    // Set default sort if not provided
    if (!queryParams['sortBy']) {
      updatedTableData.sortBy = '-datePosted';
    }
    
    this.tableData.set(updatedTableData);

    // Determine secondary sort
    const secondarySort = updatedTableData.sortBy.includes('displayName') ? '' : '+displayName';

    // Fetch data with current params
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      '',
      'Document',
      [{ 'name': 'project', 'value': this.projId }],
      updatedTableData.currentPage,
      updatedTableData.pageSize,
      updatedTableData.sortBy,
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.CERTIFICATE, this.lists),
      false,
      secondarySort
    ));
  }

  onMessageOut(msg: ITableMessage) {
    const params: Params = {};
    
    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = this.toggleSortDirection(msg.data);
        params['currentPage'] = 1;
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
    }
    
    this.submit({ ...this.route.snapshot.queryParams, ...params });
  }

  private toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;
    
    // If we're sorting by the same field, toggle direction
    if (currentSort?.includes(field)) {
      return (currentSort?.[0] === '+' ? '-' : '+') + field;
    }
    
    // Default to descending for new field
    return '-' + field;
  }

  submit(params: Params) {
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
