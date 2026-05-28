import { Component, ViewChild, ElementRef, DestroyRef, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ActivityCardComponent } from 'app/shared/components/activity-card/activity-card.component';
import { SearchActivityCardComponent } from 'app/search/cards/search-activity-card.component';
import { SearchCardListComponent } from 'app/shared/components/search-card-list/search-card-list.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { StorageService } from 'app/services/storage.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { TypesenseService } from 'app/services/typesense.service';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.css'],
  imports: [SearchCardListComponent, SearchActivityCardComponent],
})
export class ProjectActivitesComponent {
  @ViewChild('activitiesHeader', { static: false }) activitiesHeader?: ElementRef;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private storageService = inject(StorageService);
  private typesense = inject(TypesenseService);
  private destroyRef = inject(DestroyRef);

  private projId = '';

  public loadingState = inject(LoadingStateService);
  public loading = this.loadingState.getOperationState('table-projectActivities');

  keywords = signal('');
  private keywordInput$ = new Subject<string>();

  typesenseItems = signal<any[]>([]);
  typesenseTotalItems = signal(0);

  public tableData = signal<TableObject>(new TableObject({
    component: ActivityCardComponent,
    data: { showProjectInfo: false },
  }));

  constructor() {
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    // Init keyword from URL on first load
    this.keywords.set(this.route.snapshot.queryParamMap.get('keywordsActivities') ?? '');

    // Instant search debounce pipeline
    this.keywordInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(kw => {
      this.submit({
        keywordsActivities: kw || null,
        sortByActivities: kw ? '-score' : '-dateAdded',
        currentPageActivities: 1,
      });
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));

      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData(), 'Activities');
      updatedTableData.sortBy = params.sortByActivities || '-dateAdded';
      this.tableData.set(updatedTableData);

      // Keep keyword signal synced with URL (back/fwd navigation)
      this.keywords.set(params['keywordsActivities'] || '');

      const keywords = params['keywordsActivities'] || '';
      const loadingId = 'table-projectActivities';
      this.loadingState.startLoading(loadingId, 'Loading activities');
      this.typesense.getProjectActivitiesCards(
        this.projId,
        updatedTableData.currentPage,
        updatedTableData.pageSize,
        updatedTableData.sortBy,
        keywords,
      ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ items, total }) => {
          this.typesenseItems.set(items);
          this.typesenseTotalItems.set(total);
          this.tableData.update(t => {
            const updated = new TableObject({ component: ActivityCardComponent });
            Object.assign(updated, t);
            updated.totalListItems = total;
            updated.currentPage = updatedTableData.currentPage;
            updated.pageSize = updatedTableData.pageSize;
            return updated;
          });
          this.loadingState.stopLoading(loadingId);
        },
        error: () => this.loadingState.stopLoading(loadingId),
      });
    });
  }

  onTypesensePageChange(page: number): void {
    this.submit({ currentPageActivities: page });
  }

  onTypesensePageSizeChange(size: number): void {
    this.submit({ pageSizeActivities: size, currentPageActivities: 1 });
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

}

