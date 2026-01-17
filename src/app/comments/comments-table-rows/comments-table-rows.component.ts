import { Component, inject, EventEmitter, AfterViewInit, ElementRef, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api';
import { TableRowComponent, ITableMessage } from '../../shared/components/table-template/table-row-component';

@Component({
  selector: 'tr[app-comments-table-rows]',
  imports: [CommonModule],
  templateUrl: './comments-table-rows.component.html',
  styleUrls: ['./comments-table-rows.component.css'],
  standalone: true,
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
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();
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
