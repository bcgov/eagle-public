import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeWhile } from 'rxjs/operators';
import { SearchResults } from '../../models/search';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.css'],
  imports: [TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CertificatesComponent implements OnInit, OnDestroy {
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableTemplateUtils = inject(TableTemplate);
  private readonly tableService = inject(TableService);

  private readonly tableId = 'certificates';
  private alive = true;

  public readonly loading = signal(true);
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

  ngOnInit() {
    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data as any, this.tableData());
      this.tableData.set(updatedTableData);
      this.changeDetectorRef.detectChanges();
    });

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults.data !== 0) {
        const currentTableData = this.tableData();
        currentTableData.totalListItems = searchResults.totalSearchCount;
        currentTableData.items = searchResults.data.map((record: any) => {
          record.showFeatured = false;
          return { rowData: record };
        });
        currentTableData.columns = this.tableColumns;
        currentTableData.options.showAllPicker = true;

        this.tableData.set(currentTableData);
        this.loading.set(false);
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    const currentTableData = this.tableData();
    
    switch (msg.label) {
      case 'columnSort':
        if (currentTableData.sortBy.charAt(0) === '+') {
          params['sortBy'] = '-' + msg.data;
        } else {
          params['sortBy'] = '+' + msg.data;
        }

        if (params['sortBy'].includes('displayName')) {
          this.tableService.data[this.tableId].cachedConfig.secondarySort = '';
        } else {
          this.tableService.data[this.tableId].cachedConfig.secondarySort = '+displayName';
        }

        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === currentTableData.totalListItems) {
          this.loading.set(true);
        }
        params['currentPage'] = 1;
        this.tableService.data[this.tableId].cachedConfig.pageSize = params['pageSize'];
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params: any, filters: any = null) {
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.tableService.refreshData(this.tableId);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
