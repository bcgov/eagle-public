import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from 'app/services/config.service';
import { TypesenseService } from 'app/services/typesense.service';
import { UnifiedSearchComponent } from './unified-search.component';
import { SearchTableComponent } from './search-table/search-table.component';

/**
 * Wrapper that health-checks Typesense on init, then routes to either:
 * - SearchTableComponent for projects/documents/updates/notifications (table view)
 * - UnifiedSearchComponent for documents tab (card view, PDF content search)
 */
@Component({
  selector: 'app-search-wrapper',
  imports: [UnifiedSearchComponent, SearchTableComponent],
  host: { '[class.content-tab]': 'isContentTab()' },
  template: `
    @if (isContentTab()) {
      <app-unified-search [typesenseAvailable]="useTypesense()" />
    } @else {
      <app-search-table [typesenseAvailable]="useTypesense()" />
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    :host.content-tab {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  `],
})
export class SearchWrapperComponent implements OnInit {
  useTypesense  = signal(false);
  isContentTab  = signal(false);

  private configService    = inject(ConfigService);
  private typesenseService = inject(TypesenseService);
  private route            = inject(ActivatedRoute);
  private destroyRef       = inject(DestroyRef);

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.isContentTab.set(p['tab'] === 'content' || p['tab'] === 'documents'));

    this.typesenseService.checkHealth().then(available => {
      this.useTypesense.set(available);
    });
  }
}
