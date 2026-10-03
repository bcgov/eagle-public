import { describe, it, expect, afterEach } from 'vitest';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, ParamMap, Params, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { DocumentsTabComponent } from './documents/documents-tab.component';
import { AmendmentsComponent } from './amendments/amendments.component';
import { ApplicationComponent } from './application/application.component';
import { SEARCH, envelope, setupDemiApi } from '../services/demi-api.spec-helper';

const MESSAGE = 'Too many filters selected. Remove some filters and try again.';
// Every List name the amendment and application tabs look up by name; a missing one throws.
const TAB_LIST_NAMES = [
  'Amendment Package', 'Request', 'Decision Materials', 'Tracking Table', 'Amendment', 'Post Decision - Amendment',
  'Application Materials', 'Scientific Memo', 'Independent Memo', 'Application Review', 'EAC Application', 'Revised EAC Application',
];
const LISTS = TAB_LIST_NAMES.flatMap((name, i) => [2002, 2018].map(legislation => (
  { _id: `list-${i}-${legislation}`, type: 'doctype', name, legislation }
)));

/** `n` distinct 24-character ids, the shape every picked filter value has. */
function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => i.toString(16).padStart(24, 'a'));
}

// The last two search once when their lists load and again for the route's current params.
describe.each([
  ['documents', DocumentsTabComponent, 1],
  ['amendments', AmendmentsComponent, 2],
  ['application', ApplicationComponent, 2],
] as [string, Type<unknown>, number][])('%s tab filters', (_name, component, searchesPerLoad) => {
  let httpMock: HttpTestingController;
  let queryParams: BehaviorSubject<ParamMap>;

  function open(params: Params) {
    queryParams = new BehaviorSubject(convertToParamMap(params));
    const route = {
      queryParamMap: queryParams,
      snapshot: { get queryParamMap() { return queryParams.value; } },
      parent: { snapshot: { params: { projId: 'p1' } } },
    };
    httpMock = setupDemiApi([provideRouter([]), { provide: ActivatedRoute, useValue: route }], LISTS);
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture;
  }

  /** URLs of the searches sent since the last call, each answered empty. */
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

  it('sends several picked types as one comma list', () => {
    const picks = ids(3);
    open({ type: picks.join(',') });

    const pair = `&and[type]=${picks.join(',')}&`;
    expect(searches().map(url => url.includes(pair))).toEqual(Array(searchesPerLoad).fill(true));
  });

  it('sends nothing and says why when the picks make the query too long', () => {
    const fixture = open({ type: ids(80).join(',') });
    fixture.detectChanges();

    expect(searches()).toEqual([]);
    expect(message(fixture)).toBe(MESSAGE);
    expect(fixture.nativeElement.querySelector('lib-table-template')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toMatch(/No results found|There are no/);
  });

  it('searches again and drops the message once picks are removed', () => {
    const fixture = open({ type: ids(80).join(',') });
    fixture.detectChanges();
    expect(searches()).toEqual([]);

    queryParams.next(convertToParamMap({ type: ids(2).join(',') }));
    fixture.detectChanges();

    expect(searches()).toHaveLength(1);
    expect(message(fixture)).toBe('');
  });
});
