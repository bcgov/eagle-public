import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SearchResults } from '../../models/search';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchParamObject } from '../../services/search.service';
import { LoadingStateService } from '../../services/loading-state.service';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  imports: [CommonModule, TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class FeaturedDocumentsComponent implements OnInit {
  public readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly tableService = inject(TableService);
  private readonly loadingState = inject(LoadingStateService);

  private readonly tableId = 'featuredDocuments';
  private projId = '';
  private readonly tableSignal = this.tableService.getTableSignal(this.tableId);

  public readonly loading = this.loadingState.getOperationState('table-featuredDocuments');
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));

  constructor() {
    effect(() => {
      const searchResults = this.tableSignal();
      // Only process when we have actual API results (not initial null value)
      if (searchResults !== null && searchResults !== undefined) {
        const updatedTableData = this.tableData();
        if (searchResults.data && Array.isArray(searchResults.data) && searchResults.data.length > 0) {
          updatedTableData.totalListItems = searchResults.totalSearchCount;
          updatedTableData.items = searchResults.data.map((record: any) => {
            record['showFeatured'] = true;
            return { rowData: record };
          });
          updatedTableData.columns = this.tableColumns;
        } else {
          updatedTableData.totalListItems = 0;
          updatedTableData.items = [];
        }
        this.tableData.set(updatedTableData);
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
    const currentTableData = this.tableData();
    currentTableData.options.showPageCountDisplay = false;
    currentTableData.options.showPagination = false;
    currentTableData.options.showPageSizePicker = false;
    currentTableData.tableId = 'documents-table';
    currentTableData.currentPage = 1;
    currentTableData.pageSize = 5;
    currentTableData.sortBy = '-datePosted';
    this.tableData.set(currentTableData);

    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

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
