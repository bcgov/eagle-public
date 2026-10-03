import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { EngageBannerComponent } from './engage-banner.component';
import { CommentPeriod } from '../../models/commentperiod';

describe('EngageBannerComponent', () => {
  function cta(): HTMLAnchorElement {
    TestBed.configureTestingModule({ imports: [EngageBannerComponent] });
    const fixture = TestBed.createComponent(EngageBannerComponent);
    fixture.componentRef.setInput('data', new CommentPeriod({ _id: 'cp1', isMet: true, metURL: 'https://engage.eao.gov.bc.ca/site-c' }));
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('a.engage-banner__cta')!;
  }

  it('hides the new-tab icon from screen readers', () => {
    expect(cta().querySelector('.material-icons')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('tells screen readers the link opens a new tab', () => {
    expect(cta().querySelector('.visually-hidden')?.textContent).toBe('(opens in new tab)');
  });
});
