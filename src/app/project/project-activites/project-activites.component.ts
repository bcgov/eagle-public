import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ActivitiesListTableRowsComponent } from './activities-list-table-rows/activities-list-table-rows.component';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { IPageSizePickerOption } from 'app/shared/components/page-size-picker/page-size-picker.component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { takeWhile } from 'rxjs/operators';
import { ActivitiesService } from 'app/services/activities.service';
import { StorageService } from 'app/services/storage.service';
import { SearchParamObject } from 'app/services/search.service';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.scss']
})
export class ProjectActivitesComponent implements OnInit, OnDestroy {
  public loading = true;
  private currentProject;
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
    private storageService: StorageService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.currentProject = this.storageService.state.currentProject.data;

    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;

    this.tableData.tableId = 'activities-table';

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData, 'Activities');

      if (!data['params'].sortBy) {
        this.tableData.sortBy = '-dateAdded';
      }
      this.keywordSearchWords = this.queryParams.keywordsActivities;

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


    // This allows us to have multiple tables tied to a single page.
    const encodedParams = {
      currentPageActivities: this.tableData.currentPage,
      pageSizeActivities: this.tableData.pageSize,
      sortByActivities: this.tableData.sortBy
    };

    encodedParams['keywordsActivities'] = this.queryParams.keywordsActivities ? this.queryParams.keywordsActivities : null;

    this.location.replaceState(
      this.router.serializeUrl(
        this.router.createUrlTree(
          ['../project-details'],
          {
            queryParams: encodedParams,
            relativeTo: this.route,
            queryParamsHandling: 'merge',
          })
      )
    );

    await this.activitiesService.fetchData(new SearchParamObject(
      this.queryParams.keywordsActivities,
      'RecentActivity',
      [],
      this.tableData.currentPage,
      this.tableData.pageSize,
      this.tableData.sortBy,
      { project: this.currentProject._id },
      true
    ));
  }

  executeSearch(searchPackage) {
    delete this.queryParams['keywordsActivities'];
    // check keyword
    if (searchPackage.keywords) {
      this.queryParams['keywordsActivities'] = searchPackage.keywords;
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
