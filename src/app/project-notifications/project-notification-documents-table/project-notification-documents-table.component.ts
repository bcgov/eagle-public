import { Component, OnInit, ChangeDetectorRef, OnDestroy, Input } from '@angular/core';
import { SearchResults } from 'app/models/search';
import { takeWhile } from 'rxjs/operators';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { ProjectNotificationDocumentsTableRowsComponent } from '../project-notification-documents-table-rows/project-notification-documents-table-rows.component';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { BreakpointObserver, Breakpoints, MediaMatcher } from '@angular/cdk/layout';

@Component({
    selector: 'app-project-notification-documents-table',
    templateUrl: './project-notification-documents-table.component.html',
    styleUrls: ['./project-notification-documents-table.component.scss']
})
export class ProjectNotificationDocumentsTableComponent implements OnInit, OnDestroy {
    @Input() tableId: string;
    @Input() header: string;

    private alive = true;
    public loading: Boolean = true;

    public tableData: TableObject = new TableObject({ component: ProjectNotificationDocumentsTableRowsComponent });
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
    public tableColumns: any[] = [
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
    constructor(
        private _changeDetectionRef: ChangeDetectorRef,
        private tableService: TableService,
        private breakpointObserver: BreakpointObserver,
        private mediaMatcher: MediaMatcher
    ) {
    }

    async ngOnInit() {
        this.breakpointObserver.observe([
            Breakpoints.Tablet
        ])
            .pipe(takeWhile(() => this.alive))
            .subscribe(result => {
                if (result.matches) {
                    this.tableData.columns = this.mobileTableColumns;
                    this._changeDetectionRef.detectChanges();
                }
            });
        this.breakpointObserver.observe([
            Breakpoints.Web
        ])
            .pipe(takeWhile(() => this.alive))
            .subscribe(result => {
                if (result.matches) {
                    this.tableData.columns = this.tableColumns;
                    this._changeDetectionRef.detectChanges();
                }
            });

        this.tableData.tableId = this.tableId;
        this.tableData.pageSize = 5;
        this.tableData.options.showPageSizePicker = false;
        this.tableData.options.showPageCountDisplay = false;
        this.tableData.options.showAllPicker = false;
        this.tableData.options.showPagination = true;
        this.tableData.options.showTopControls = false;

        this.tableService.initTableData(this.tableId);
        await this.tableService.fetchData(new SearchParamObject(
            this.tableId,
            '',
            'Document',
            [{ 'name': 'project', 'value': this.tableId }],
            1,
            5,
            '-datePosted',
            { documentSource: 'PROJECT-NOTIFICATION' },
            true,
            '+displayName'
        ));

        this.tableService.getValue(this.tableId)
            .pipe(takeWhile(() => this.alive))
            .subscribe((searchResults: SearchResults) => {
                if (searchResults.data !== 0) {
                    this.tableData.totalListItems = searchResults.totalSearchCount;
                    if (this.tableData.totalListItems > 0) {
                        this.tableData.items = searchResults.data.map(record => {
                            return { rowData: record };
                        });
                    } else {
                        this.tableData.items = [];
                    }
                    const mediaQueryList = this.mediaMatcher.matchMedia(Breakpoints.Web);
                    this.tableData.columns = mediaQueryList.matches ? this.tableColumns : this.mobileTableColumns;

                    this.loading = false;
                    this._changeDetectionRef.detectChanges();
                }
            });
    }

    onMessageOut(msg: ITableMessage) {
        let params = {};
        switch (msg.label) {
            case 'columnSort':
                if (this.tableData.sortBy.charAt(0) === '+') {
                    params['sortBy'] = '-' + msg.data;
                } else {
                    params['sortBy'] = '+' + msg.data;
                }
                this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
                this.tableData.sortBy = params['sortBy'];
                break;
            case 'pageNum':
                params['currentPage'] = msg.data;
                this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
                this.tableData.currentPage = params['currentPage'];
                break;
            default:
                break;
        }
        this.submit();
    }

    submit() {
        this.tableService.refreshData(this.tableId);
    }

    ngOnDestroy() {
        this.alive = false;
    }
}
