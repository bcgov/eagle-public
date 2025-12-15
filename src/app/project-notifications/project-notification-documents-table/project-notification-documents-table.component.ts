import { Component, OnInit, ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy, inject, input, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints, MediaMatcher } from '@angular/cdk/layout';
import { takeWhile } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { TableObject } from '../../shared/components/table-template/table-object';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableService } from '../../services/table.service';
import { SearchParamObject } from '../../services/search.service';
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
  private _changeDetectionRef = inject(ChangeDetectorRef);
  private breakpointObserver = inject(BreakpointObserver);
  private mediaMatcher = inject(MediaMatcher);

  private alive = true;
  loading = signal(true);

  tableData: TableObject = new TableObject();
  
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

  async ngOnInit() {
    this.breakpointObserver.observe([Breakpoints.Tablet])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          this.tableData.columns = this.mobileTableColumns;
          this._changeDetectionRef.detectChanges();
        }
      });

    this.breakpointObserver.observe([Breakpoints.Web])
      .pipe(takeWhile(() => this.alive))
      .subscribe(result => {
        if (result.matches) {
          this.tableData.columns = this.tableColumns;
          this._changeDetectionRef.detectChanges();
        }
      });

    this.tableData.tableId = this.tableId();
    this.tableData.pageSize = 5;
    this.tableData.options.showPageSizePicker = false;
    this.tableData.options.showPageCountDisplay = false;
    this.tableData.options.showAllPicker = false;
    this.tableData.options.showPagination = true;
    this.tableData.options.showTopControls = false;

    this.tableService.initTableData(this.tableId());
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

    this.tableService.getValue(this.tableId())
      .pipe(takeWhile(() => this.alive))
      .subscribe((searchResults: any) => {
        if (searchResults.data !== 0) {
          this.tableData.totalListItems = searchResults.totalSearchCount;
          if (this.tableData.totalListItems > 0) {
            this.tableData.items = searchResults.data.map((record: any) => {
              return { rowData: record };
            });
          } else {
            this.tableData.items = [];
          }
          const mediaQueryList = this.mediaMatcher.matchMedia(Breakpoints.Web);
          this.tableData.columns = mediaQueryList.matches ? this.tableColumns : this.mobileTableColumns;

          this.loading.set(false);
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
        this.tableService.data[this.tableId()].cachedConfig.sortBy = params['sortBy'];
        this.tableData.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId()].cachedConfig.currentPage = params['currentPage'];
        this.tableData.currentPage = params['currentPage'];
        break;
      default:
        break;
    }
    this.submit();
  }

  submit() {
    this.tableService.refreshData(this.tableId());
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
