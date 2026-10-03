import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';
import { documentDownloadUrl } from 'app/shared/utils/legacy-document-url';
import { ConfigService } from 'app/services/config.service';

/**
 * One content-search result: a DOCUMENT, with the passages that matched inside it.
 *
 * The snippets arrive as markup and are bound with `[innerHTML]`. That is safe because eagle-search
 * escapes the document text BEFORE turning its highlight sentinels into `<mark>`, and balances the
 * tags per fragment — see `service/snippet.js` there. Angular's sanitizer keeps `<mark>` and strips
 * anything else, so this is belt and braces rather than the only guard.
 */
@Component({
  selector: 'app-content-result',
  templateUrl: './content-result.component.html',
  styleUrls: ['./content-result.component.css'],
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ContentResultComponent {
  private utils = inject(Utils);
  private configService = inject(ConfigService);

  readonly result = input.required<any>();

  /**
   * The document itself, shown in the browser through the demi-search download route.
   *
   * There is deliberately no `#page=N` fragment. This card briefly rendered "Jump to page N" links
   * built from the chunk's `pageNumber`, and every one of them was wrong: `pageNumber` is a passage
   * SEQUENCE number, not a PDF page — the chunker increments it per emitted block and the extraction
   * host flattens pages before posting. Measured, a 63-chunk document carries 51 distinct values.
   * Page links come back when the extractor emits real per-page markdown, and not before.
   */
  documentUrl(): string {
    return documentDownloadUrl(this.configService.getSearchApiPath(), this.result()._id, { inline: true });
  }

  /** Matches only. There is no trustworthy page count to pair it with. */
  readonly matchSummary = computed(() => {
    const matches = this.result().matchCount || 0;
    return `${matches} match${matches === 1 ? '' : 'es'}`;
  });

  download(): void {
    const r = this.result();
    this.utils.openDocumentDownload({ _id: r._id, displayName: r.documentName });
  }
}
