import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CommentingTabComponent } from './commenting-tab.component';
import { CommentPeriod } from '../../models/commentperiod';
import { Project } from '../../models/project';
import { CommentPeriodService } from '../../services/commentperiod.service';
import { StorageService } from '../../services/storage.service';
import { setupDemiApi } from '../../services/demi-api.spec-helper';

const DAY = 24 * 60 * 60 * 1000;
const OPEN = { dateStarted: new Date(Date.now() - DAY).toISOString(), dateCompleted: new Date(Date.now() + 7 * DAY).toISOString() };
const CLOSED = { dateStarted: new Date(Date.now() - 30 * DAY).toISOString(), dateCompleted: new Date(Date.now() - 7 * DAY).toISOString() };
const ENGAGE = { isMet: true, metURL: 'https://engage.eao.gov.bc.ca/site-c' };

describe('CommentingTabComponent', () => {
  function buttonLabel(fields: object): string | undefined {
    const period = new CommentPeriod({ _id: 'cp1', project: 'p1', ...fields });
    setupDemiApi([
      { provide: CommentPeriodService, useValue: { getAllByProjectId: () => of({ data: [period] }), isOpen: () => false, isClosed: () => false, isNotStarted: () => false } },
    ]);
    TestBed.inject(StorageService).currentProject.set(new Project({ _id: 'p1' }));
    const fixture = TestBed.createComponent(CommentingTabComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('button')?.textContent?.trim();
  }

  it.each([
    ['an open ENGAGE period', 'Share your thoughts', { ...OPEN, ...ENGAGE }],
    ['a closed ENGAGE period', 'View Engagement', { ...CLOSED, ...ENGAGE }],
    ['an open period with no ENGAGE page', 'View Comment Period', OPEN],
    ['an open period with an unsafe ENGAGE link', 'View Comment Period', { ...OPEN, isMet: true, metURL: 'javascript:alert(1)' }],
  ])('labels %s "%s"', (_name, label, fields) => {
    expect(buttonLabel(fields)).toBe(label);
  });
});
