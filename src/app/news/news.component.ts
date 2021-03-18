import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ActivitiesListTableRowsComponent } from 'app/project/project-activites/activities-list-table-rows/activities-list-table-rows.component';
import { ActivitiesService } from 'app/services/activities.service';
import { IPageSizePickerOption } from 'app/shared/components/page-size-picker/page-size-picker.component';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { takeWhile } from 'rxjs/operators';
import { SearchParamObject } from 'app/services/search.service';


@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss']
})

export class NewsListComponent implements OnInit, OnDestroy {
  public loading = true;
  private alive = true;
  public queryParams: Params;
  public keywordSearchWords: string;

  public tableData: TableObject2 = new TableObject2({ component: ActivitiesListTableRowsComponent });
  public tableColumns: IColumnObject[] = [
    {
      name: 'Headline',
      value: 'headine',
      width: 'col-10',
      nosort: true
    },
    {
      name: 'Date',
      value: 'dateAdded',
      width: 'col-2',
      nosort: true
    }
  ];
  constructor(
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplate,
    private activitiesService: ActivitiesService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData);

      if (this.tableData.sortBy === '-datePosted') {
        this.tableData.sortBy = '-dateAdded';
      }
      this.keywordSearchWords = this.queryParams.keywords;

      this._changeDetectionRef.detectChanges();
    });

    this.activitiesService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        return { rowData: record };
      });
      this.tableData.columns = this.tableColumns;
      this.tableData.options.showAllPicker = true;

      this.loading = false;

      this._changeDetectionRef.detectChanges();
    });
  }

  onMessageOut(msg: ITableMessage) {
    switch (msg.label) {
      case 'columnSort':
        this.setColumnSort(msg.data);
        break;
      case 'pageNum':
        this.onPageNumUpdate(msg.data);
        break;
      case 'pageSize':
        this.onPageSizeUpdate(msg.data);
        break;
      default:
        break;
    }
  }

  setColumnSort(column) {
    if (this.tableData.sortBy.charAt(0) === '+') {
      this.tableData.sortBy = '-' + column;
    } else {
      this.tableData.sortBy = '+' + column;
    }
    this.submit();
  }

  onPageNumUpdate(pageNumber) {
    this.tableData.currentPage = pageNumber;
    this.submit();
  }

  onPageSizeUpdate(pageSize: IPageSizePickerOption) {
    this.tableData.pageSize = pageSize.value;
    if (this.tableData.pageSize === this.tableData.totalListItems) {
      this.loading = true;
    }
    this.tableData.currentPage = 1;
    this.submit();
  }

  async submit() {
    delete this.queryParams.sortBy;
    delete this.queryParams.currentPage;
    delete this.queryParams.pageNumber;
    delete this.queryParams.pageSize;

    const params = { ...this.queryParams, ...this.tableTemplateUtils.getNavParamsObj(this.tableData) }

    this.location.replaceState(
      this.router.serializeUrl(
        this.router.createUrlTree(
          ['/news'],
          {
            queryParams: params,
            relativeTo: this.route,
            queryParamsHandling: 'merge',
          })
      )
    );

    await this.activitiesService.fetchData(new SearchParamObject(
      this.queryParams.keywords,
      'RecentActivity',
      [],
      this.tableData.currentPage,
      this.tableData.pageSize,
      this.tableData.sortBy,
      {},
      true
    ));
  }

  executeSearch(searchPackage) {
    delete this.queryParams['keywords'];
    // check keyword
    if (searchPackage.keywords) {
      this.queryParams['keywords'] = searchPackage.keywords;
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        this.tableData.sortBy = '-score';
      }
    } else {
      this.tableData.sortBy = '-dateAdded';
    }

    this.tableData.currentPage = 1;
    this.submit();
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
