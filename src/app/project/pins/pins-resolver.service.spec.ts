import { TestBed, inject } from '@angular/core/testing';

import { PinsResolverService } from './pins-resolver.service';

describe('PinsResolverService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PinsResolverService]
    });
  });

  it('should be created', inject([PinsResolverService], (service: PinsResolverService) => {
    expect(service).toBeTruthy();
  }));
});
