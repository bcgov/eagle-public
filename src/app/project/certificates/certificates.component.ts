import {
  Component,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { Constants } from '../../shared/utils/constants';
import { ProjectDocumentTabBase } from '../shared/project-document-tab-base';
import { TypesenseDocumentTableComponent } from '../shared/typesense-document-table.component';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styles: [':host { display: flex; flex-direction: column; flex: 1; min-height: 0; }'],
  imports: [
    TableTemplateComponent,
    TypesenseDocumentTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificatesComponent extends ProjectDocumentTabBase {
  // ── MongoDB fallback state ─────────────────────────────────────────────────
  protected readonly tableId = 'certificates';
  protected readonly filtersList: string[] = [];
  protected readonly dateFiltersList: string[] = [];

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

  protected initListData(_list: any[]): void {
    // Certificates has no filter panels in MongoDB path; no list parsing needed
  }

  protected fetchDataWithCurrentParams(): void {
    if (this.isTypesense()) return;

    const updated = this.readCurrentParams();
    const secondarySort = updated.sortBy.includes('displayName') ? '' : '+displayName';

    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      '',
      'Document',
      [{ name: 'project', value: this.projId }],
      updated.currentPage,
      updated.pageSize,
      updated.sortBy,
      this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.CERTIFICATE, this.lists),
      false,
      secondarySort
    ));
  }
}
