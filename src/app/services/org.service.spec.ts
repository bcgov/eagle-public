import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { OrgService } from './org.service';
import { envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

const TYPE = 'Proponent/Certificate Holder';

function orgs(count: number, prefix: string): any[] {
  return Array.from({ length: count }, (_, i) => ({ _id: `${prefix}${i}`, name: `${prefix}${i}` }));
}

describe('OrgService DEMI reads', () => {
  let httpMock: HttpTestingController;
  let service: OrgService;

  beforeEach(() => {
    httpMock = setupDemiApi();
    service = TestBed.inject(OrgService);
  });

  afterEach(() => httpMock.verify());

  it('asks the Organization dataset for one company type, by name', async () => {
    const result = firstValueFrom(service.getByCompanyType(TYPE));
    const req = searchRequest(httpMock, 'Organization');
    req.flush(envelope([]));
    await result;
    expect(req.request.url).toContain(`&and[companyType]=${TYPE}`);
    expect(req.request.url).toContain('&sortBy=+name');
    expect(req.request.url).toContain('&pageNum=0&pageSize=500');
  });

  it('reads the next page while a page comes back full', async () => {
    const result = firstValueFrom(service.getByCompanyType(TYPE));
    searchRequest(httpMock, 'Organization').flush(envelope(orgs(500, 'a'), 502));
    const second = searchRequest(httpMock, 'Organization');
    expect(second.request.url).toContain('&pageNum=1&');
    second.flush(envelope(orgs(2, 'b'), 502));
    expect((await result).length).toBe(502);
  });

  it('stops at a short page', async () => {
    const result = firstValueFrom(service.getByCompanyType(TYPE));
    searchRequest(httpMock, 'Organization').flush(envelope(orgs(3, 'a')));
    expect((await result).map(org => org.name)).toEqual(['a0', 'a1', 'a2']);
  });
});
