import {
  Component,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';
import { Constants } from '../../shared/utils/constants';
import { ProjectDocumentTabBase } from '../shared/project-document-tab-base';
import { TypesenseDocumentTableComponent } from '../shared/typesense-document-table.component';

@Component({
  selector: 'app-application',
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.css'],
  imports: [
    TableTemplateComponent,
    SearchFilterTemplateComponent,
    TypesenseDocumentTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationComponent extends ProjectDocumentTabBase {
  // ── MongoDB fallback state ─────────────────────────────────────────────────
  protected readonly tableId = 'application';
  protected readonly filtersList = ['milestone', 'type', 'projectPhase'];
  protected readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];

  public override readonly showAdvancedFilters = signal(false);
  public readonly filters = signal<FilterObject[]>([]);
  public readonly tableColumns: IColumnObject[] = [
    { name: 'Name',      value: 'displayName',  width: 'col-4' },
    { name: 'Date',      value: 'datePosted',   width: 'col-2' },
    { name: 'Type',      value: 'type',         width: 'col-2' },
    { name: 'Milestone', value: 'milestone',    width: 'col-2' },
    { name: 'Phase',     value: 'projectPhase', width: 'col-2' },
  ];
  public readonly tableData = signal<TableObject>(new TableObject({ component: DocumentTableRowsComponent, columns: this.tableColumns }));

  constructor() {
    super();
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.tableService.clearTable(this.tableId);
    this.setup();
  }

  protected initListData(list: any[]): void {
    const milestone: any[] = [];
    const documentType: any[] = [];
    const projectPhase: any[] = [];
    const lfg = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };
    for (const item of list) {
      switch (item.type) {
        case 'label':        milestone.push({ ...item }); break;
        case 'doctype':      documentType.push({ ...item }); break;
        case 'projectPhase': projectPhase.push({ ...item }); break;
      }
    }
    this.filters.set([
      new FilterObject(
        'issuedDate', FilterType.DateRange, '',
        new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
        6
      ),
      new FilterObject(
        'milestone', FilterType.MultiSelect, 'Milestone',
        new MultiSelectDefinition(milestone, [], lfg, null, true),
        6
      ),
      new FilterObject(
        'type', FilterType.MultiSelect, 'Document Type',
        new MultiSelectDefinition(documentType, [], lfg, null, true),
        6
      ),
      new FilterObject(
        'projectPhase', FilterType.MultiSelect, 'Project Phase',
        new MultiSelectDefinition(projectPhase, [], lfg, null, true),
        6
      ),
    ]);
  }

  protected fetchDataWithCurrentParams(): void {
    if (this.isTypesense()) return;

    const updated = this.readCurrentParams();
    const secondarySort = updated.sortBy.includes('displayName') ? '' : '+displayName';

    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      this.queryParams['keywords'] || '',
      'Document',
      [{ name: 'project', value: this.projId }],
      updated.currentPage,
      updated.pageSize,
      updated.sortBy,
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.APPLICATION, this.lists),
      false,
      secondarySort,
      this.buildFilters()
    ));
  }

  // ── MongoDB fallback handlers ──────────────────────────────────────────────

  onResetControls(): void {
    const params: any = {};
    [...this.filtersList, ...this.dateFiltersList].forEach(filter => {
      params[filter] = null;
    });
    params['keywords'] = null;
    params['currentPage'] = 1;
    params['sortBy'] = '-datePosted';
    this.submit(params);
  }

}
