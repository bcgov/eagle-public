
import { DomSanitizer } from '@angular/platform-browser';
import { PipeTransform, Pipe, inject } from '@angular/core';

// This pipe strips out script tags, do not use with (non-staff) user input
@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private sanitized = inject(DomSanitizer);

  transform(value: any) {
    return this.sanitized.bypassSecurityTrustHtml(value);
  }
}
