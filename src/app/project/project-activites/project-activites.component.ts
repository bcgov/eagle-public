import { Component, OnDestroy, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Subject } from 'rxjs';
import { takeWhile, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { ActivityCardComponent } from 'app/shared/components/activity-card/activity-card.component';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { StorageService } from 'app/services/storage.service';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';
import { TypesenseService } from 'app/services/typesense.service';
import { ConfigService } from 'app/services/config.service';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.css'],
  imports: [TableTemplateComponent, SearchFilterTemplateComponent, FormsModule],
  standalone: true
})
export class ProjectActivitesComponent implements OnDestroy {
  @ViewChild('activitiesHeader', { static: false }) activitiesHeader?: ElementRef;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private storageService = inject(StorageService);
  private typesense = inject(TypesenseService);
  private configService = inject(ConfigService);

  private alive = true;
  private readonly tableId = 'projectActivities';
  private projId = '';
  private readonly tableSignal$ = toObservable(this.tableService.getTableSignal(this.tableId));

  public loadingState = inject(LoadingStateService);
  public loading = this.loadingState.getOperationState('table-projectActivities');
  public queryParams: Params = {};

  // Instant search (Typesense path)
  isTypesense = computed(() => !!this.configService.config().TYPESENSE_ENABLED);
  keywords = signal('');
  private keywordInput$ = new Subject<string>();

  public tableData = signal<TableObject>(new TableObject({ component: ActivityCardComponent, data: { showProjectInfo: false } }));

  constructor() {
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.tableService.clearTable(this.tableId);

    // Init keyword from URL on first load
    this.keywords.set(this.route.snapshot.queryParamMap.get('keywordsActivities') ?? '');

    // Instant search debounce pipeline (Typesense path only)
    this.keywordInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeWhile(() => this.alive),
    ).subscribe(kw => {
      this.submit({
        keywordsActivities: kw || null,
        sortByActivities: kw ? '-score' : '-dateAdded',
        currentPageActivities: 1,
      });
    });

    // MongoDB path: react to tableService signal
    this.tableSignal$.pipe(takeWhile(() => this.alive)).subscribe(searchResults => {
      if (searchResults !== null && searchResults !== undefined) {
        const hasItems = searchResults.data?.length > 0;
        const items = hasItems ? searchResults.data : [];
        const total = hasItems ? searchResults.totalSearchCount : 0;
        this.tableData.set(this.buildActivityTable(this.tableData(), items, total));
      }
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.queryParams = { ...params };
      
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData(), 'Activities');
      updatedTableData.sortBy = params.sortByActivities || '-dateAdded';
      this.tableData.set(updatedTableData);

      // Keep keyword signal synced with URL (back/fwd navigation)
      this.keywords.set(params['keywordsActivities'] || '');

      const config = this.configService.config();
      const keywords = params['keywordsActivities'] || '';
      // Use Typesense when enabled (browse + keyword search).
      // Falls back to MongoDB when Typesense is disabled (e.g. prod before Typesense deploy).
      if (config.TYPESENSE_ENABLED) {
        const loadingId = 'table-projectActivities';
        this.loadingState.startLoading(loadingId, 'Loading activities');
        this.typesense.getProjectActivities(
          this.projId,
          updatedTableData.currentPage,
          updatedTableData.pageSize,
          updatedTableData.sortBy,
          keywords,
        ).pipe(takeWhile(() => this.alive)).subscribe({
          next: ({ items, total }) => {
            this.tableData.set(this.buildActivityTable(updatedTableData, items, total));
            this.loadingState.stopLoading(loadingId);
          },
          error: () => this.loadingState.stopLoading(loadingId),
        });
      } else {
        this.tableService.fetchData(new SearchParamObject(
          this.tableId,
          keywords,
          'RecentActivity',
          [],
          updatedTableData.currentPage,
          updatedTableData.pageSize,
          updatedTableData.sortBy,
          { project: this.projId },
          true
        ));
      }
    });
  }

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

  private buildActivityTable(ref: TableObject, items: any[], total: number): TableObject {
    const t = new TableObject({
      component: ActivityCardComponent,
      data: { showProjectInfo: false },
      pageSize: ref.pageSize,
      currentPage: ref.currentPage,
      sortBy: ref.sortBy,
      tableId: 'activities-table',
    });
    t.totalListItems = total;
    t.items = items.map(record => ({ rowData: record }));
    t.columns = this.tableColumns;
    t.options.showAllPicker = true;
    t.options.disableRowHighlight = true;
    return t;
  }

  onInstantInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.keywords.set(value);
    this.keywordInput$.next(value);
  }

  clearInstantSearch(): void {
    this.keywords.set('');
    this.keywordInput$.next('');
  }

  onMessageOut(msg: ITableMessage) {
    const params: any = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPageActivities'] = msg.data;
        break;
      case 'pageSize':
        params['pageSizeActivities'] = msg.data.value;
        params['currentPageActivities'] = 1;
        break;
    }
    this.submit(params);
  }

  executeSearch(searchPackage: any) {
    const params: any = {
      keywordsActivities: searchPackage.keywords || null,
      sortByActivities: searchPackage.keywords && searchPackage.keywordsChanged ? '-score' : '-dateAdded',
      currentPageActivities: 1
    };
    this.submit(params);
  }

  submit(params: any) {
    if (this.activitiesHeader?.nativeElement) {
      const headerElement = this.activitiesHeader.nativeElement;
      this.storageService.state = {
        type: 'scrollPosition',
        data: [window.scrollX, headerElement.offsetTop - (headerElement.clientHeight * 2)]
      };
    }
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route,
      queryParamsHandling: 'merge'
    });
  }

  ngOnDestroy() {
    this.alive = false;
    this.keywordInput$.complete();
  }
}
