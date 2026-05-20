import { Component, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Utils } from 'app/shared/utils/utils';

@Component({
  selector: 'tr[app-search-doc-table-rows]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink],
  styles: [`
    .download-icon {
      color: var(--font-color);
      cursor: pointer;
      transition: color 0.15s ease-in-out, transform 0.15s ease-in-out;
    }
    .download-icon:hover {
      color: var(--gold);
      transform: scale(1.1);
    }
  `],
  template: `
    <td data-label="Document Name" class="col-3">{{ rowData.displayName }}</td>
    <td data-label="Project" class="col-2">
      @if (rowData.projectId) {
        <a [routerLink]="['/p', rowData.projectId, 'project-details']"
           [attr.aria-label]="'Link to project ' + rowData.projectName">{{ rowData.projectName }}</a>
      }
    </td>
    <td data-label="Date" class="col-2">
      @if (rowData._datePosted) {
        {{ rowData._datePosted | date:'longDate' }}
      }
    </td>
    <td data-label="Type" class="col-2">{{ rowData.type }}</td>
    <td data-label="Milestone" class="col-2">{{ rowData.milestone }}</td>
    <td data-label="Download" class="col-1 d-flex justify-content-center">
      <span class="material-icons download-icon"
        (click)="download()"
        (keyup.enter)="download()"
        tabindex="0"
        aria-label="Download document">cloud_download</span>
    </td>
  `,
})
export class SearchDocTableRowsComponent implements TableRowComponent {
  private utils = inject(Utils);

  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  download(): void {
    if (this.rowData._id) {
      this.utils.openDocumentDownload({
        _id: this.rowData._id,
        documentFileName: this.rowData.documentFileName,
        displayName: this.rowData.displayName,
      });
    }
  }
}
