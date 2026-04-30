import {
  Component,
  signal,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { LoggingService } from '../../services/logging.service';
import { ProjectDocumentTabBase } from '../shared/project-document-tab-base';
import { TypesenseDocumentTableComponent } from '../shared/typesense-document-table.component';

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  imports: [
    TableTemplateComponent,
    SearchFilterTemplateComponent,
    TypesenseDocumentTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsTabComponent extends ProjectDocumentTabBase {
  private readonly logger = inject(LoggingService);
  // ── MongoDB fallback state ─────────────────────────────────────────────────
  protected readonly tableId = 'documentsTab';
  protected readonly filtersList = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
  protected readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];
  protected override readonly showFeatured: boolean = true;

  private readonly milestoneArray: any[] = [];
  private readonly documentAuthorTypeArray: any[] = [];
  private readonly documentTypeArray: any[] = [];
  private readonly projectPhaseArray: any[] = [];
  private readonly legislationFilterGroup = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };

  public override readonly showAdvancedFilters = signal(false);
  public readonly filters = signal<FilterObject[]>([]);
  public readonly tableData = signal<TableObject>(new TableObject({
    component: DocumentTableRowsComponent,
    sortBy: '-datePosted'
  }));

  public readonly tableColumns: IColumnObject[] = [
    { name: '★',         value: 'isFeatured',   width: 'col-1' },
    { name: 'Name',      value: 'displayName',  width: 'col-3' },
    { name: 'Date',      value: 'datePosted',   width: 'col-2' },
    { name: 'Type',      value: 'type',         width: 'col-2' },
    { name: 'Milestone', value: 'milestone',    width: 'col-2' },
    { name: 'Phase',     value: 'projectPhase', width: 'col-2' },
  ];

  constructor() {
    super();
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.logger.debug(`Documents tab projId: ${this.projId}`, 'DocumentsTabComponent');
    this.tableService.clearTable(this.tableId);
    this.setup();
  }

  protected initListData(list: any[]): void {
    list.forEach(item => {
      if (item.type === 'label') {
        this.milestoneArray.push({ ...item });
      } else if (item.type === 'author') {
        this.documentAuthorTypeArray.push({ ...item });
      } else if (item.type === 'doctype') {
        this.documentTypeArray.push({ ...item });
      } else if (item.type === 'projectPhase') {
        this.projectPhaseArray.push({ ...item });
      }
    });
    this.setMongoFilters();
  }

  protected fetchDataWithCurrentParams(): void {
    if (this.isTypesense()) return;

    const updated = this.readCurrentParams();
    this.logger.debug(`Fetching documents with projId: ${this.projId}`, 'DocumentsTabComponent', {
      currentPage: updated.currentPage,
      pageSize: updated.pageSize,
      sortBy: updated.sortBy,
      filters: this.buildFilters()
    });
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      this.queryParams['keywords'] || '',
      'Document',
      [],
      updated.currentPage,
      updated.pageSize,
      updated.sortBy,
      { project: this.projId },
      true,
      updated.sortBy.includes('displayName') ? '' : '+displayName',
      this.buildFilters()
    ));
  }

  // ── MongoDB fallback handlers ──────────────────────────────────────────────

  private setMongoFilters(): void {
    this.filters.set([
      new FilterObject(
        'issuedDate', FilterType.DateRange, '',
        new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
        8
      ),
      new FilterObject(
        'milestone', FilterType.MultiSelect, 'Milestone',
        new MultiSelectDefinition(this.milestoneArray, [], this.legislationFilterGroup, null, true),
        4
      ),
      new FilterObject(
        'documentAuthorType', FilterType.MultiSelect, 'Document Author',
        new MultiSelectDefinition(this.documentAuthorTypeArray, [], this.legislationFilterGroup, null, true),
        4
      ),
      new FilterObject(
        'type', FilterType.MultiSelect, 'Document Type',
        new MultiSelectDefinition(this.documentTypeArray, [], this.legislationFilterGroup, null, true),
        4
      ),
      new FilterObject(
        'projectPhase', FilterType.MultiSelect, 'Project Phase',
        new MultiSelectDefinition(this.projectPhaseArray, [], this.legislationFilterGroup, null, true),
        4
      ),
    ]);
  }

  // NOTE: executeSearch intentionally overrides base — preserves existing sort
  // when keywords change without keywordsChanged flag (e.g. filter-only updates).
  override executeSearch(searchPackage: any): void {
    const params: any = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-datePosted';
    }
    params['currentPage'] = 1;

    const queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage, this.filtersList, this.dateFiltersList
    );
    this.submit(params, queryFilters);
  }

  override onMessageOut(msg: ITableMessage): void {
    const params: any = {};
    const currentTableData = this.tableData();
    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = (currentTableData.sortBy.charAt(0) === '+' ? '-' : '+') + msg.data;
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
    }
    this.submit(params);
  }

  onResetControls(): void {
    const currentTableData = this.tableData();
    if (currentTableData.sortBy.includes('score')) {
      currentTableData.sortBy = '-datePosted';
      this.tableData.set(currentTableData);
    }
  }
}
