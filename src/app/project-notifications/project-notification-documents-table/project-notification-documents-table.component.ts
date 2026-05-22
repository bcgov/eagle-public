import { Component, OnInit, ChangeDetectionStrategy, inject, input, signal, effect, untracked } from '@angular/core';
import { MediaMatcher, Breakpoints } from '@angular/cdk/layout';


import { TableObject } from '../../shared/components/table-template/table-object';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { SearchParamObject } from '../../services/search.service';
import { LoadingStateService } from '../../services/loading-state.service';
import { ApiService } from '../../services/api';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { LoggingService } from '../../services/logging.service';
import { ProjectNotificationDocumentsTableRowsComponent } from '../project-notification-documents-table-rows/project-notification-documents-table-rows.component';
import { HttpCacheService } from '../../interceptors/http-cache.interceptor';
@Component({
  selector: 'app-project-notification-documents-table',
  templateUrl: './project-notification-documents-table.component.html',
  styleUrls: ['./project-notification-documents-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableTemplateComponent],
})
export class ProjectNotificationDocumentsTableComponent implements OnInit {
  tableId = input.required<string>();
  header = input.required<string>();
  backgroundColor = input<string>('transparent');
  rowBackgroundColor = input<string>('#F7F8FA');

  private tableService = inject(TableService);
  private mediaMatcher = inject(MediaMatcher);
  public loadingState = inject(LoadingStateService);
  private logger = inject(LoggingService);
  private api = inject(ApiService);

  tableData = signal<TableObject>(new TableObject());
  
  private readonly mobileTableColumns = [
    { name: 'Name', value: 'displayName', width: 'col-6' },
    { name: 'Date', value: 'datePosted', width: 'col-3' },
    { name: 'Author', value: 'documentAuthor', width: 'col-3' }
  ];

  private readonly tableColumns = [
    { name: 'Document Name', value: 'displayName', width: 'col-6' },
    { name: 'Date', value: 'datePosted', width: 'col-3' },
    { name: 'Document Author', value: 'documentAuthor', width: 'col-3' }
  ];

  constructor() {
    // Watch for table data changes from service
    effect(() => {
      const tableId = this.tableId();
      if (!tableId) return;
      
      const tableSignal = this.tableService.getTableSignal(tableId);
      const searchResults = tableSignal();
      
      if (searchResults && searchResults.data && searchResults.data !== 0) {
        // Use untracked to read current state without creating dependencies
        untracked(() => {
          const currentTableData = this.tableData();
          
          // Prevent infinite loop by checking timestamp
          if (currentTableData.data?.lastTimestamp === searchResults._timestamp) {
            return;
          }
          
          const mediaQueryList = this.mediaMatcher.matchMedia(Breakpoints.Web);
          
          // Create a new TableObject to trigger change detection
          const updatedTableData = new TableObject({
            tableId: currentTableData.tableId,
            component: currentTableData.component ?? undefined,
            columns: mediaQueryList.matches ? this.tableColumns : this.mobileTableColumns,
            items: searchResults.data.map((record: any) => ({ rowData: record })),
            dataset: currentTableData.dataset,
            currentPage: currentTableData.currentPage,
            pageSizeOptions: currentTableData.pageSizeOptions,
            pageSize: currentTableData.pageSize,
            sortBy: currentTableData.sortBy,
            totalListItems: searchResults.totalSearchCount,
            options: currentTableData.options,
            data: { ...currentTableData.data, lastTimestamp: searchResults._timestamp }
          });

          this.tableData.set(updatedTableData);
        });
      }
    });
  }

  async ngOnInit() {
    const currentTableData = this.tableData();
    currentTableData.tableId = this.tableId();
    currentTableData.component = ProjectNotificationDocumentsTableRowsComponent;
    currentTableData.pageSize = 5;
    currentTableData.sortBy = '-datePosted';
    currentTableData.options.showPageSizePicker = false;
    currentTableData.options.showPageCountDisplay = false;
    currentTableData.options.showAllPicker = false;
    currentTableData.options.showPagination = true;
    currentTableData.options.showTopControls = false;
    currentTableData.options.disableRowHighlight = false;
    currentTableData.options.rowSpacing = 0;
    currentTableData.data = { rowBackgroundColor: this.rowBackgroundColor() };
    this.tableData.set(currentTableData);

    await this.tableService.fetchData(new SearchParamObject(
      this.tableId(),
      '',
      'Document',
      [{ 'name': 'project', 'value': this.tableId() }],
      1,
      5,
      this.invertSortForBackend('-datePosted'),
      { documentSource: 'PROJECT-NOTIFICATION' },
      true
    ));
  }

  onMessageOut(msg: ITableMessage) {
    switch (msg.label) {
      case 'columnSort': {
        const currentTableData = this.tableData();
        const currentSortBy = currentTableData.sortBy || '-datePosted';
        const currentSortField = currentSortBy.replace(/^[+-]/, '');
        
        // Determine new sort direction
        let newSortBy: string;
        if (currentSortField === msg.data) {
          // Toggle: if currently descending (-), go to ascending (+), and vice versa
          newSortBy = currentSortBy.startsWith('-') ? `+${msg.data}` : `-${msg.data}`;
        } else {
          // New column: default to descending (-)
          newSortBy = `-${msg.data}`;
        }
        
        currentTableData.sortBy = newSortBy;
        this.tableData.set(currentTableData);
        this.submit();
        break;
      }
      case 'pageNum': {
        const tableData = this.tableData();
        tableData.currentPage = msg.data;
        this.tableData.set(tableData);
        this.submit();
        break;
      }
    }
  }

  submit() {
    const currentTableData = this.tableData();
    const sortBy = currentTableData.sortBy || '-datePosted';
    
    HttpCacheService.clearByPrefix(`${this.api.apiPath}/search?dataset=Document`);
    
    this.tableService.fetchData(new SearchParamObject(
      this.tableId(),
      '',
      'Document',
      [{ 'name': 'project', 'value': this.tableId() }],
      currentTableData.currentPage,
      currentTableData.pageSize,
      this.invertSortForBackend(sortBy),
      { documentSource: 'PROJECT-NOTIFICATION' },
      true
    ));
  }

  /**
   * Backend uses inverted sort convention: + = descending, - = ascending
   * UI uses standard convention: - = descending, + = ascending
   */
  private invertSortForBackend(sortBy: string): string {
    return sortBy.startsWith('+') 
      ? `-${sortBy.substring(1)}` 
      : `+${sortBy.substring(1)}`;
  }
}
