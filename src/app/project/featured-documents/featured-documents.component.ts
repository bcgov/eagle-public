import { Component, OnInit, ChangeDetectorRef, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { takeWhile } from 'rxjs/operators';
import { SearchResults } from '../../models/search';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableService } from '../../services/table.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';

@Component({
  selector: 'app-featured-documents',
  templateUrl: './featured-documents.component.html',
  styleUrls: ['./featured-documents.component.css'],
  imports: [CommonModule, TableTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class FeaturedDocumentsComponent implements OnInit, OnDestroy {
  public readonly location = inject(Location);
  private readonly tableService = inject(TableService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  private readonly tableId = 'featuredDocuments';
  private alive = true;

  public readonly loading = signal(true);
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent }));
  
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

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults.data !== 0) {
        const updatedTableData = this.tableData();
        updatedTableData.totalListItems = searchResults.totalSearchCount;
        updatedTableData.items = searchResults.data.map((record: any) => {
          record['showFeatured'] = true;
          return { rowData: record };
        });
        updatedTableData.columns = this.tableColumns;
        
        this.tableData.set(updatedTableData);
        this.loading.set(false);
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
