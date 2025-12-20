import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject, input, signal, effect } from '@angular/core';
import { BreakpointObserver, Breakpoints, MediaMatcher } from '@angular/cdk/layout';
import { takeWhile } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { TableObject } from '../../shared/components/table-template/table-object';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { SearchParamObject } from '../../services/search.service';
import { LoadingStateService } from '../../services/loading-state.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';

@Component({
  selector: 'app-project-notification-documents-table',
  templateUrl: './project-notification-documents-table.component.html',
  styleUrls: ['./project-notification-documents-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableTemplateComponent],
  standalone: true
})
export class ProjectNotificationDocumentsTableComponent implements OnInit, OnDestroy {
  tableId = input.required<string>();
  header = input.required<string>();

  private tableService = inject(TableService);
  private breakpointObserver = inject(BreakpointObserver);
  private mediaMatcher = inject(MediaMatcher);
  private loadingState = inject(LoadingStateService);

  private alive = true;
  private tableSignal = this.tableService.getTableSignal('');
  loading = this.loadingState.getOperationState('project-notification-docs');

  tableData = signal<TableObject>(new TableObject());
  
  private mobileTableColumns: any[] = [
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-6'
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-3'
    },
    {
      name: 'Author',
      value: 'documentAuthor',
      width: 'col-3'
    }
  ];

  private tableColumns: any[] = [
    {
      name: 'Document Name',
      value: 'displayName',
      width: 'col-6'
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-3'
    },
    {
      name: 'Document Author',
      value: 'documentAuthor',
      width: 'col-3'
    }
  ];

  constructor() {
    // Watch for table data changes from service
    effect(() => {
      const tableId = this.tableId();
      if (tableId) {
        // Update signal reference when tableId changes
        this.tableSignal = this.tableService.getTableSignal(tableId);
      }
    });

    effect(() => {
      const searchResults = this.tableSignal();
      
      if (searchResults && searchResults.data && searchResults.data !== 0) {
        const updatedTableData = this.tableData();
        updatedTableData.totalListItems = searchResults.totalSearchCount;
        if (updatedTableData.totalListItems > 0) {
          updatedTableData.items = searchResults.data.map((record: any) => {
            return { rowData: record };
          });
        } else {
          updatedTableData.items = [];
        }
        const mediaQueryList = this.mediaMatcher.matchMedia(Breakpoints.Web);
        updatedTableData.columns = mediaQueryList.matches ? this.tableColumns : this.mobileTableColumns;

        this.tableData.set(updatedTableData);
      }
    });
  }

  async ngOnInit() {
    this.breakpointObserver.observe([Breakpoints.Tablet])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          const updatedTableData = this.tableData();
          updatedTableData.columns = this.mobileTableColumns;
          this.tableData.set(updatedTableData);
        }
      });

    this.breakpointObserver.observe([Breakpoints.Web])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          const updatedTableData = this.tableData();
          updatedTableData.columns = this.tableColumns;
          this.tableData.set(updatedTableData);
        }
      });

    const currentTableData = this.tableData();
    currentTableData.tableId = this.tableId();
    currentTableData.pageSize = 5;
    currentTableData.options.showPageSizePicker = false;
    currentTableData.options.showPageCountDisplay = false;
    currentTableData.options.showAllPicker = false;
    currentTableData.options.showPagination = true;
    currentTableData.options.showTopControls = false;
    this.tableData.set(currentTableData);

    await this.tableService.fetchData(new SearchParamObject(
      this.tableId(),
      '',
      'Document',
      [{ 'name': 'project', 'value': this.tableId() }],
      1,
      5,
      '-datePosted',
      { documentSource: 'PROJECT-NOTIFICATION' },
      true,
      '+displayName'
    ));
  }

  onMessageOut(msg: ITableMessage) {
    const currentTableData = this.tableData();
    
    switch (msg.label) {
      case 'columnSort':
        currentTableData.sortBy = currentTableData.sortBy.charAt(0) === '+' 
          ? '-' + msg.data 
          : '+' + msg.data;
        this.tableData.set(currentTableData);
        break;
      case 'pageNum':
        currentTableData.currentPage = msg.data;
        this.tableData.set(currentTableData);
        break;
    }
    
    this.submit();
  }

  submit() {
    const currentTableData = this.tableData();
    this.tableService.fetchData(new SearchParamObject(
      this.tableId(),
      '',
      'Document',
      [{ 'name': 'project', 'value': this.tableId() }],
      currentTableData.currentPage,
      currentTableData.pageSize,
      currentTableData.sortBy,
      { documentSource: 'PROJECT-NOTIFICATION' },
      true,
      '+displayName'
    ));
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
