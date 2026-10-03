import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ProjectNotificationsTableRowsComponent } from './project-notifications-table-rows.component';
import { CommentPeriod } from '../../models/commentperiod';
import { CommentPeriodService } from '../../services/commentperiod.service';
import { setupDemiApi } from '../../services/demi-api.spec-helper';

const DAY = 24 * 60 * 60 * 1000;
const METURL = 'https://engage.eao.gov.bc.ca/site-c';

describe('ProjectNotificationsTableRowsComponent commenting tab', () => {
  let navigate: ReturnType<typeof vi.fn>;

  function open(fields: object): HTMLButtonElement {
    const period = new CommentPeriod({
      _id: 'cp1',
      project: 'pn1',
      dateStarted: new Date(Date.now() - DAY).toISOString(),
      dateCompleted: new Date(Date.now() + 7 * DAY).toISOString(),
      ...fields,
    });
    navigate = vi.fn();
    setupDemiApi([
      { provide: Router, useValue: { navigate } },
      { provide: CommentPeriodService, useValue: { getAllByProjectId: () => of({ data: [period] }), isOpen: () => true, isClosed: () => false, isNotStarted: () => false } },
    ]);
    const fixture = TestBed.createComponent(ProjectNotificationsTableRowsComponent);
    fixture.componentInstance.rowData = { _id: 'pn1', pcp: 'open' };
    fixture.componentInstance.setActiveTab('commenting');
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.cp-card button')!;
  }

  afterEach(() => vi.restoreAllMocks());

  it('opens an ENGAGE period in a new tab under "Share your thoughts"', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const button = open({ isMet: true, metURL: METURL });
    expect(button.textContent?.trim()).toBe('Share your thoughts');
    button.click();
    expect(openSpy).toHaveBeenCalledWith(METURL, '_blank');
  });

  it('labels a period with an unsafe ENGAGE link "View Comment Period" and opens nothing', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const button = open({ isMet: true, metURL: 'javascript:alert(1)' });
    expect(button.textContent?.trim()).toBe('View Comment Period');
    button.click();
    expect(openSpy).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['pn', 'pn1', 'cp', 'cp1']);
  });
});
