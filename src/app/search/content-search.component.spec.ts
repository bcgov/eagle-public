import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { ContentSearchComponent } from './content-search.component';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';

/**
 * What this tab asks the API for. The filter controls were removed because the chunk index cannot
 * answer them for every value, so the request must carry no filter keys — a regression here is
 * silent, since the API drops what it cannot use and answers 200 with an unfiltered corpus.
 */
describe('ContentSearchComponent', () => {
  let sent: SearchParamObject[];

  beforeEach(() => {
    sent = [];
    TestBed.configureTestingModule({
      imports: [ContentSearchComponent],
      providers: [
        {
          provide: TableService,
          useValue: {
            fetchData: vi.fn((param: SearchParamObject) => { sent.push(param); return Promise.resolve(); }),
            getTableSignal: () => signal(null)
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParams: { keywords: 'pipeline', milestone: 'm1', type: 't1', datePostedStart: '2020-01-01' } },
            queryParams: of({})
          }
        }
      ]
    });

    // ngOnInit directly, never detectChanges: rendering the template pulls in the shared filter
    // template and the pagination component, and what is under test is which request this tab
    // sends — not its markup.
    TestBed.createComponent(ContentSearchComponent).componentInstance.ngOnInit();
  });

  it('searches the chunk index for the keyword', () => {
    expect(sent).toHaveLength(1);
    expect(sent[0].dataset).toBe('DocumentChunk');
    expect(sent[0].keywords).toBe('pipeline');
  });

  it('sends no filter keys, even when the URL still carries them', () => {
    // A stale link or a bookmark from before the controls were removed still carries these. They
    // must not be forwarded: `type` and the date range are dropped by the API unconditionally, and
    // `milestone` is dropped for the highest-volume values, so a forwarded key comes back as the
    // whole corpus wearing the label of a filtered result.
    expect(sent[0].filters).toEqual({});
  });
});
