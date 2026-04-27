import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { LoggingService } from '../../services/logging.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { ProjectDocumentTabBase } from '../shared/project-document-tab-base';

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  imports: [TableTemplateComponent, SearchFilterTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsTabComponent extends ProjectDocumentTabBase {
  private readonly logger = inject(LoggingService);
  private readonly analytics = inject(AnalyticsService);

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
    this.setFilters();
  }

  protected fetchDataWithCurrentParams(): void {
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

  private setFilters(): void {
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

  navSearchHelp(): void {
    this.analytics.track('Search Help Clicked', {
      context: 'documents_tab',
      project_id: this.projId
    });
    this.router.navigate(['/search-help']);
  }

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
    const filterCounts = this.countFilters(queryFilters);
    this.analytics.track('Document Filters Applied', {
      project_id: this.projId,
      milestone_count: filterCounts.milestone,
      document_type_count: filterCounts.type,
      author_count: filterCounts.documentAuthorType,
      phase_count: filterCounts.projectPhase,
      has_date_range: filterCounts.hasDateRange,
      has_keyword: !!searchPackage.keywords,
      keyword_length: searchPackage.keywords?.length || 0,
      total_filters: filterCounts.total
    });
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

  override onToggleFiltersPanel(event: { showPanel: boolean }): void {
    this.showAdvancedFilters!.set(event.showPanel);
    this.analytics.track('Document Filters Panel Toggled', {
      project_id: this.projId,
      is_open: event.showPanel
    });
  }

  onResetControls(): void {
    const currentTableData = this.tableData();
    if (currentTableData.sortBy.includes('score')) {
      currentTableData.sortBy = '-datePosted';
      this.tableData.set(currentTableData);
    }
  }

  private countFilters(queryFilters: any): any {
    const counts = {
      milestone: 0, type: 0, documentAuthorType: 0, projectPhase: 0,
      hasDateRange: false, total: 0
    };
    if (queryFilters) {
      if (queryFilters.milestone) {
        counts.milestone = Array.isArray(queryFilters.milestone) ? queryFilters.milestone.length : 1;
        counts.total += counts.milestone;
      }
      if (queryFilters.type) {
        counts.type = Array.isArray(queryFilters.type) ? queryFilters.type.length : 1;
        counts.total += counts.type;
      }
      if (queryFilters.documentAuthorType) {
        counts.documentAuthorType = Array.isArray(queryFilters.documentAuthorType) ? queryFilters.documentAuthorType.length : 1;
        counts.total += counts.documentAuthorType;
      }
      if (queryFilters.projectPhase) {
        counts.projectPhase = Array.isArray(queryFilters.projectPhase) ? queryFilters.projectPhase.length : 1;
        counts.total += counts.projectPhase;
      }
      if (queryFilters.datePostedStart || queryFilters.datePostedEnd) {
        counts.hasDateRange = true;
        counts.total += 1;
      }
    }
    return counts;
  }
}
