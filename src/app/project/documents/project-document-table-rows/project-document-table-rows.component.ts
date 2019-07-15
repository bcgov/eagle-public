import { Component, Input, Output, OnInit, OnDestroy, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { TableComponent } from 'app/shared/components/table-template/table.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from 'app/services/api';

const encode = encodeURIComponent;
window['encodeURIComponent'] = (component: string) => {
  return encode(component).replace(/[!'()*]/g, (c) => {
    // Also encode !, ', (, ), and *
    return '%' + c.charCodeAt(0).toString(16);
  });
};

@Component({
  selector: 'tbody[app-document-table-rows]',
  templateUrl: './project-document-table-rows.component.html',
  styleUrls: ['./project-document-table-rows.component.scss']
})

export class DocumentTableRowsComponent implements OnInit, OnDestroy, TableComponent {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  @Input() data: TableObject;
  @Output() selectedCount: EventEmitter<any> = new EventEmitter();

  public documents: any;
  public paginationData: any;
  private lists: any[] = [];
  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private api: ApiService,
    private router: Router
  ) { }

  ngOnInit() {
    this.documents = this.data.data;
    this.paginationData = this.data.paginationData;
    this.route.data
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res) {
          if (res.documentsTableRow && res.documentsTableRow.length > 0) {
            this.lists = res.documentsTableRow;
          } else {
            alert('Uh-oh, couldn\'t load list');
            this.lists = [];
          }
          this._changeDetectionRef.detectChanges();
        }
      });
  }
  // idToList is replacement for list-converter.pipe.ts, add it is because this.config.list doesn't always load properly
  idToList(id: string) {
    if (!id) {
      return '-';
    }
    // Grab the item from the constant lists, returning the name field of the object.
    let item = this.lists.filter(listItem => listItem._id === id);
    if (item.length !== 0) {
      return item[0].name;
    } else {
      return '-';
    }
  }
  selectItem(item) {
    item.checkbox = !item.checkbox;

    let count = 0;
    this.documents.map(doc => {
      if (doc.checkbox === true) {
        count++;
      }
    });
    this.selectedCount.emit(count);
  }

  goToItem(item) {
    let filename = item.documentFileName;
    let safeName = filename;
    try {
      safeName = encode(filename).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '_').replace(/\//g, '_').replace(/\%2F/g, '_');
    } catch (e) {
      console.log('error:', e);
    }
    window.open('/api/document/' + item._id + '/fetch/' + safeName, '_blank');
  }
  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
