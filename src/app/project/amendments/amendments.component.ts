import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';
import { Constants } from '../../shared/utils/constants';
import { ProjectDocumentTabBase } from '../shared/project-document-tab-base';

@Component({
  selector: 'app-amendments',
  templateUrl: './amendments.component.html',
  imports: [TableTemplateComponent, SearchFilterTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmendmentsComponent extends ProjectDocumentTabBase {
  protected readonly tableId = 'amendments';
  protected readonly filtersList = ['milestone', 'type', 'projectPhase'];
  protected readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];

  private readonly milestoneArray: any[] = [];
  private readonly documentTypeArray: any[] = [];
  private readonly projectPhaseArray: any[] = [];

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
    list.forEach((item: any) => {
      switch (item.type) {
        case 'label':        this.milestoneArray.push({ ...item }); break;
        case 'doctype':      this.documentTypeArray.push({ ...item }); break;
        case 'projectPhase': this.projectPhaseArray.push({ ...item }); break;
      }
    });
    this.setFilters();
  }

  protected fetchDataWithCurrentParams(): void {
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
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.AMENDMENT, this.lists),
      false,
      secondarySort,
      this.buildFilters()
    ));
  }

  onResetControls(): void {
    if (this.tableData().sortBy.includes('score')) {
      this.submit({ sortBy: '-datePosted' });
    }
  }

  private setFilters(): void {
    this.filters.set([
      new FilterObject(
        'issuedDate', FilterType.DateRange, '',
        new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
        6
      ),
      new FilterObject(
        'milestone', FilterType.MultiSelect, 'Milestone',
        new MultiSelectDefinition(this.milestoneArray, [], null, null, true),
        6
      ),
      new FilterObject(
        'type', FilterType.MultiSelect, 'Document Type',
        new MultiSelectDefinition(this.documentTypeArray, [], null, null, true),
        4
      ),
      new FilterObject(
        'projectPhase', FilterType.MultiSelect, 'Project Phase',
        new MultiSelectDefinition(this.projectPhaseArray, [], null, null, true),
        4
      ),
    ]);
  }
}
