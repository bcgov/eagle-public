import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ConfigService } from 'app/services/config.service';
import { TypesenseService } from 'app/services/typesense.service';
import { UnifiedSearchComponent } from './unified-search.component';

/**
 * Wrapper that health-checks Typesense on init, then renders UnifiedSearchComponent
 * with typesenseAvailable=true/false so the 3 search tabs know whether to show results
 * or an unavailable message.
 *
 * Notifications and Map tabs always work regardless of Typesense status.
 */
@Component({
  selector: 'app-search-wrapper',
  imports: [UnifiedSearchComponent],
  template: `<app-unified-search [typesenseAvailable]="useTypesense()" />`,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  `],
})
export class SearchWrapperComponent implements OnInit {
  useTypesense = signal(false);

  private configService = inject(ConfigService);
  private typesenseService = inject(TypesenseService);

  async ngOnInit(): Promise<void> {
    const config = this.configService.config();

    if (!config.TYPESENSE_ENABLED) {
      return;
    }

    const available = await this.typesenseService.checkHealth();
    this.useTypesense.set(available);
  }
}
