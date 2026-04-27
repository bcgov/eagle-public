import { Component, OnInit, inject, signal, ChangeDetectionStrategy, effect, untracked, computed, DestroyRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchParamObject } from '../../services/search.service';
import { LoadingStateService } from '../../services/loading-state.service';
import { TypesenseService } from '../../services/typesense.service';
import { ConfigService } from '../../services/config.service';
import { SearchDocumentCardComponent } from '../../search/cards/search-document-card.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  imports: [TableTemplateComponent, SearchDocumentCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedDocumentsComponent implements OnInit {
  public readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly tableService = inject(TableService);
  private readonly loadingState = inject(LoadingStateService);
  private readonly typesense = inject(TypesenseService);
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tableId = 'featuredDocuments';
  private projId = '';
  private readonly tableSignal = this.tableService.getTableSignal(this.tableId);

  public readonly loading = this.loadingState.getOperationState('table-featuredDocuments');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));
  /** Cards shown in the Typesense path (raw Typesense document objects). */
  public readonly featuredCards = signal<any[]>([]);

  public readonly isTypesense = computed(() => !!this.configService.config().TYPESENSE_ENABLED);

  constructor() {
    this.tableService.clearTable(this.tableId);
    // MongoDB path: react to tableService signal
    effect(() => {
      const searchResults = this.tableSignal();
      if (searchResults !== null && searchResults !== undefined) {
        const current = untracked(() => this.tableData());
        const updated = new TableObject({
          component: DocumentTableRowsComponent,
          pageSize: current.pageSize,
          currentPage: current.currentPage,
          sortBy: current.sortBy,
          tableId: current.tableId,
        });
        updated.options = { ...current.options };
        if (searchResults.data && Array.isArray(searchResults.data) && searchResults.data.length > 0) {
          updated.totalListItems = searchResults.totalSearchCount;
          updated.items = searchResults.data.map((record: any) => {
            record['showFeatured'] = true;
            return { rowData: record };
          });
          updated.columns = this.tableColumns;
        } else {
          updated.totalListItems = 0;
          updated.items = [];
        }
        this.tableData.set(updated);
      }
    });
  }
  
  public readonly tableColumns: IColumnObject[] = [
    {
      name: '★',
      value: 'isFeatured',
      width: 'col-1',
      nosort: true
    },
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-3',
      nosort: true
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-2',
      nosort: true
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2',
      nosort: true
    },
    {
      name: 'Milestone',
      value: 'milestone',
      width: 'col-2',
      nosort: true
    },
    {
      name: 'Phase',
      value: 'projectPhase',
      width: 'col-2',
      nosort: true
    }
  ];

  ngOnInit() {
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    if (this.isTypesense()) {
      this.loadingState.startLoading('table-featuredDocuments', 'Loading featured documents');
      this.typesense.getFeaturedDocumentsCards(this.projId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (docs) => {
            this.featuredCards.set(docs);
            this.loadingState.stopLoading('table-featuredDocuments');
          },
          error: () => this.loadingState.stopLoading('table-featuredDocuments'),
        });
    } else {
      const currentTableData = this.tableData();
      currentTableData.options.showPageCountDisplay = false;
      currentTableData.options.showPagination = false;
      currentTableData.options.showPageSizePicker = false;
      currentTableData.tableId = 'documents-table';
      currentTableData.currentPage = 1;
      currentTableData.pageSize = 5;
      currentTableData.sortBy = '-datePosted';
      this.tableData.set(currentTableData);

      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        '',
        'Document',
        [{ name: 'project', value: this.projId }],
        1,
        5,
        '-datePosted',
        { isFeatured: 'true' },
        false,
        ''
      ));
    }
  }
}
