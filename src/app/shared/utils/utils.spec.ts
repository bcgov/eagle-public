import { Utils } from './utils';
import 'zone.js';
import 'zone.js/dist/async-test.js';
import 'zone.js/dist/proxy.js';
import 'zone.js/dist/sync-test';
import 'zone.js/dist/jasmine-patch';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

describe('Utils', () => {
  let utilsComponent: Utils;
  let filenameWithSpaces = 'Ajax Mine - Information Bulletin.pdf';
  beforeEach(async(() => {}));

  beforeEach(() => {
    utilsComponent = new Utils();
  });

  it('TEST1: spaces in document links', () => {
    let encodedFilename = utilsComponent.encodeFilename(filenameWithSpaces, true);
    let expectedFilename = 'Ajax%20Mine%20-%20Information%20Bulletin.pdf';
    expect(encodedFilename).toBe(expectedFilename);
  })
})
