import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchResults } from '../../models/search';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { takeWhile } from 'rxjs/operators';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';

@Component({
  selector: 'app-application',
  imports: [CommonModule, TableTemplateComponent],
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ApplicationComponent implements OnInit, OnDestroy {
  private _changeDetectionRef = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);

  private tableId = 'application';
  public tableParams: any = { totalListItems: 0, currentPage: 1, pageSize: 10, sortBy: '' };
  public loading = true;
  private alive = true;

  public tableData: TableObject = new TableObject();
  public tableColumns: IColumnObject[] = [
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
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData);
      if (!params.sortBy) {
        this.tableData.sortBy = '+sortOrder,-datePosted,+displayName';
      }

      this._changeDetectionRef.detectChanges();
    });

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map((record: any) => {
          record.showFeatured = false;
          return { rowData: record };
        });
        this.tableData.columns = this.tableColumns;
        this.tableData.options.showAllPicker = true;

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
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loading = true;
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
