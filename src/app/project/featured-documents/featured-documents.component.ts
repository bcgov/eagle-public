import { Component, OnInit, inject, signal, ChangeDetectionStrategy, effect, untracked, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchParamObject } from '../../services/search.service';
import { LoadingStateService } from '../../services/loading-state.service';
import { TypesenseService } from '../../services/typesense.service';
import { ConfigService } from '../../services/config.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  imports: [TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedDocumentsComponent implements OnInit {
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
          updated.items = searchResults.data.map((record: any) => ({ rowData: record }));
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
      name: 'Name',
      value: 'displayName',
      width: 'col-4',
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

    const currentTableData = this.tableData();
    currentTableData.options.showPageCountDisplay = false;
    currentTableData.options.showPagination = false;
    currentTableData.options.showPageSizePicker = false;
    currentTableData.tableId = 'documents-table';
    currentTableData.currentPage = 1;
    currentTableData.pageSize = 5;
    currentTableData.sortBy = '-datePosted';
    this.tableData.set(currentTableData);

    const typesenseEnabled = !!this.configService.config().TYPESENSE_ENABLED;

    if (typesenseEnabled) {
      this.loadingState.startLoading('table-featuredDocuments', 'Loading featured documents');
      this.typesense.getFeaturedDocumentsCards(this.projId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (docs) => {
            const current = this.tableData();
            const updated = new TableObject({
              component: DocumentTableRowsComponent,
              pageSize: current.pageSize,
              currentPage: current.currentPage,
              sortBy: current.sortBy,
              tableId: current.tableId,
            });
            updated.options = { ...current.options };
            updated.totalListItems = docs.length;
            updated.items = docs.map((doc: any) => ({
              rowData: {
                ...doc,
                _id: doc.id,
                datePosted: doc.datePosted * 1000,
              },
            }));
            updated.columns = this.tableColumns;
            this.tableData.set(updated);
            this.loadingState.stopLoading('table-featuredDocuments');
          },
          error: () => this.loadingState.stopLoading('table-featuredDocuments'),
        });
    } else {
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
