import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SEARCH_TABS, createSearchConfig, visibleSearchTabs } from './search.config';
import { ConfigService } from 'app/services/config.service';

describe('visibleSearchTabs', () => {
  it('keeps both tabs when content search is enabled', () => {
    expect(visibleSearchTabs(true)).toEqual(SEARCH_TABS);
  });

  it('drops the Document Content tab when content search is disabled', () => {
    expect(visibleSearchTabs(false).map(tab => tab.label)).toEqual(['Documents']);
  });
});

describe('createSearchConfig', () => {
  function configWith(contentSearchEnabled: boolean) {
    TestBed.configureTestingModule({
      providers: [{
        provide: ConfigService,
        useValue: { contentSearchEnabled: () => contentSearchEnabled, lists: of([]) }
      }]
    });
    return TestBed.runInInjectionContext(() => createSearchConfig());
  }

  it('hides the Document Content tab when the flag is off', () => {
    expect(configWith(false).tabs?.map(tab => tab.label)).toEqual(['Documents']);
  });

  it('shows the Document Content tab when the flag is on', () => {
    expect(configWith(true).tabs?.map(tab => tab.label)).toEqual(['Documents', 'Document Content']);
  });
});
