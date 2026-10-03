import { describe, it, expect, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Params, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { TableListComponent } from './table-list.component';
import { TableListConfig } from './table-list-config.interface';
import { FilterObject, FilterType, MultiSelectDefinition } from '../search-filter-template/filter-object';
import { SEARCH, envelope, setupDemiApi } from 'app/services/demi-api.spec-helper';
import { SEARCH_TOO_LONG_MESSAGE } from 'app/shared/utils/search-query-limit';

@Component({ selector: 'app-row', template: '', standalone: true })
class RowComponent {}

const CONFIG: TableListConfig = {
  tableId: 'projectList',
  datasetType: 'Project',
  defaultSort: '+name',
  heroBanner: { title: 'Projects', description: '', actions: [] },
  tableColumns: [],
  tableRowComponent: RowComponent,
  filterList: ['type'],
  dateFilterList: [],
  filterDataSource: of([]),
  filterBuilder: () => [new FilterObject('type', FilterType.MultiSelect, 'Type', new MultiSelectDefinition([], [], null, null, true))],
};

describe('TableListComponent query length', () => {
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<Params>;

  function open(params: Params) {
    queryParams = new BehaviorSubject(params);
    const route = {
      queryParams,
      queryParamMap: of({ params }),
      snapshot: { get queryParams() { return queryParams.value; } },
    };
    httpMock = setupDemiApi([provideRouter([]), { provide: ActivatedRoute, useValue: route }]);
    const fixture = TestBed.createComponent(TableListComponent);
    fixture.componentRef.setInput('config', CONFIG);
    fixture.detectChanges();
    return fixture;
  }

  function searches(): string[] {
    return httpMock.match(req => req.url.startsWith(`${SEARCH}/search?`)).map(req => {
      req.flush(envelope([]));
      return req.request.url;
    });
  }

  function message(fixture: { nativeElement: HTMLElement }): string | undefined {
    return fixture.nativeElement.querySelector('[role="alert"]')?.textContent?.trim();
  }

  afterEach(() => httpMock.verify());

  it('sends nothing and says why when the keywords make the query too long', () => {
    const fixture = open({ keywords: 'a'.repeat(2100) });
    fixture.detectChanges();

    expect(searches()).toEqual([]);
    expect(message(fixture)).toBe(SEARCH_TOO_LONG_MESSAGE);
    expect(fixture.nativeElement.querySelector('lib-table-template')).toBeNull();
  });

  it('searches again and drops the message once the keywords are shorter', () => {
    const fixture = open({ keywords: 'a'.repeat(2100) });
    fixture.detectChanges();
    expect(searches()).toEqual([]);

    queryParams.next({ keywords: 'mine' });
    fixture.detectChanges();

    expect(searches()).toHaveLength(1);
    expect(message(fixture)).toBeUndefined();
    expect(fixture.nativeElement.querySelector('lib-table-template')).not.toBeNull();
  });
});
