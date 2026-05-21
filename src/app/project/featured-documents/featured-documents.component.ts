import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { LoadingStateService } from '../../services/loading-state.service';
import { TypesenseService } from '../../services/typesense.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  imports: [TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedDocumentsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly loadingState = inject(LoadingStateService);
  private readonly typesense = inject(TypesenseService);
  private readonly destroyRef = inject(DestroyRef);

  private projId = '';

  public readonly loading = this.loadingState.getOperationState('table-featuredDocuments');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));

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
  }
}
