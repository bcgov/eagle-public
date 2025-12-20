import { Component, OnInit, OnDestroy, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { takeWhile } from 'rxjs/operators';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { LoadingStateService } from '../../services/loading-state.service';

@Component({
  selector: 'app-application',
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.css'],
  imports: [TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ApplicationComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableTemplateUtils = inject(TableTemplate);
  private readonly tableService = inject(TableService);
  private readonly loadingState = inject(LoadingStateService);

  private readonly tableId = 'application';
  private alive = true;
  private projId = '';

  public readonly loading = this.loadingState.getOperationState('table-application');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));
  
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

  constructor() {
    // Watch for table data changes from service
    const tableSignal = this.tableService.getTableSignal(this.tableId);
    effect(() => {
      const searchResults = tableSignal();
      
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
  }

  ngOnInit() {
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    // Subscribe to query params and fetch data
    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data as any, this.tableData());
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
        { documentSource: 'PROJECT', type: 'certificate-amendment' },
        true,
        secondarySort
      ));
    });
  }

  onMessageOut(msg: ITableMessage) {
    const params: Params = {};
    const currentTableData = this.tableData();
    const currentParams = this.route.snapshot.queryParams;
    
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
    
    this.submit({ ...currentParams, ...params });
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
