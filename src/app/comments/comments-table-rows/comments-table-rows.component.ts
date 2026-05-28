import { Component, inject, AfterViewInit, ElementRef, ChangeDetectorRef, signal, output } from '@angular/core';
import { Subject } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../services/api';
import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';

@Component({
  selector: 'tr[app-comments-table-rows]',
  imports: [DatePipe],
  templateUrl: './comments-table-rows.component.html',
  styleUrls: ['./comments-table-rows.component.css'],
  host: {
    'class': 'border',
    '[style.cursor]': '"default"'
  }
})
export class CommentsTableRowsComponent implements TableRowComponent, AfterViewInit {
  private api = inject(ApiService);
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  
  rowData: any;
  tableData: any;
  messageOut = output<ITableMessage>();
  messageIn = new Subject<ITableMessage>();
  hasOverflow = signal(false);

  ngAfterViewInit() {
    setTimeout(() => {
      const truncatedP = this.elementRef.nativeElement.querySelector('.comment-truncated');
      if (!truncatedP) return;
      
      // Temporarily disable line-clamp to measure full height
      truncatedP.style.webkitLineClamp = 'unset';
      const fullHeight = truncatedP.scrollHeight;
      truncatedP.style.webkitLineClamp = '';
      
      this.hasOverflow.set(fullHeight > truncatedP.clientHeight);
    }, 0);
  }

  toggle(comment: any) {
    comment.expanded = !comment.expanded;

  }

  openAttachment(file: any) {
    this.api.openDocument(file);
  }
}
