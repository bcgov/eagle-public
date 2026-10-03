import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { ConfigService } from 'app/services/config.service';
import { ActivityCardComponent } from './activity-card.component';
import { TableObject } from 'app/shared/components/table-template/table-object';

const mockAnalyticsService = { track: vi.fn() };

describe('ActivityCardComponent', () => {
  let component: ActivityCardComponent;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [ActivityCardComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: mockAnalyticsService }
      ]
    });

    const fixture = TestBed.createComponent(ActivityCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ─── tableMode ────────────────────────────────────────────────────────────

  it('tableMode is false when tableData is null (home page context)', () => {
    component.tableData = null as any;
    expect(component.tableMode).toBe(false);
  });

  it('tableMode is true when tableData is set (table-template context)', () => {
    component.tableData = new TableObject();
    expect(component.tableMode).toBe(true);
  });

  // ─── showProjectInfoEffective ─────────────────────────────────────────────

  it('showProjectInfoEffective returns @Input value when tableData is null', () => {
    component.tableData = null as any;
    component.showProjectInfo = true;
    expect(component.showProjectInfoEffective).toBe(true);
  });

  it('showProjectInfoEffective returns false from @Input when tableData is null', () => {
    component.tableData = null as any;
    component.showProjectInfo = false;
    expect(component.showProjectInfoEffective).toBe(false);
  });

  it('showProjectInfoEffective reads tableData.data.showProjectInfo=false', () => {
    component.tableData = new TableObject({ data: { showProjectInfo: false } });
    component.showProjectInfo = true; // @Input says true but table config overrides
    expect(component.showProjectInfoEffective).toBe(false);
  });

  it('showProjectInfoEffective reads tableData.data.showProjectInfo=true', () => {
    component.tableData = new TableObject({ data: { showProjectInfo: true } });
    component.showProjectInfo = false; // @Input says false but table config overrides
    expect(component.showProjectInfoEffective).toBe(true);
  });

  it('showProjectInfoEffective falls back to @Input when tableData has no data config', () => {
    component.tableData = new TableObject(); // no data property
    component.showProjectInfo = true;
    expect(component.showProjectInfoEffective).toBe(true);
  });

  it('showProjectInfoEffective defaults to true when neither tableData nor @Input is set', () => {
    component.tableData = null as any;
    // showProjectInfo defaults to true in the class
    expect(component.showProjectInfoEffective).toBe(true);
  });

  // ─── contentHtml ──────────────────────────────────────────────────────────

  it('contentHtml strips Word HTML via sanitizeWordHtml', () => {
    component.rowData = { content: '<p class="MsoNormal" style="margin: 0;">Hello world.</p>' };
    expect(component.contentHtml).not.toContain('MsoNormal');
    expect(component.contentHtml).not.toContain('margin');
  });

  it('contentHtml is empty for a row with no content', () => {
    component.rowData = null;
    expect(component.contentHtml).toBe('');
    component.rowData = {};
    expect(component.contentHtml).toBe('');
  });

  it('contentHtml preserves clean HTML', () => {
    component.rowData = { content: '<p>Clean paragraph.</p>' };
    expect(component.contentHtml).toContain('Clean paragraph.');
  });

  // ─── isSingleDoc ──────────────────────────────────────────────────────────

  it('isSingleDoc returns false for empty string', () => {
    expect(component.isSingleDoc('')).toBe(false);
  });

  it('isSingleDoc returns false for null', () => {
    expect(component.isSingleDoc(null)).toBe(false);
  });

  it('isSingleDoc returns false for undefined', () => {
    expect(component.isSingleDoc(undefined)).toBe(false);
  });

  it('isSingleDoc returns true for a valid URL', () => {
    expect(component.isSingleDoc('https://example.com/doc.pdf')).toBe(true);
  });

  // ─── goToCP ───────────────────────────────────────────────────────────────

  it('goToCP tracks analytics event', () => {
    const activity = {
      type: 'Public Comment Period',
      project: { _id: 'proj1', name: 'Test Project' },
      pcp: { _id: 'pcp1', isMet: false, metURL: null }
    };

    // Prevent navigation side-effects
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.goToCP(activity);

    expect(mockAnalyticsService.track).toHaveBeenCalledWith('News Item Clicked', {
      activity_type: 'Public Comment Period',
      project_id: 'proj1',
      project_name: 'Test Project',
      has_comment_period: true,
      is_met: false
    });
  });

  it('goToCP opens metURL in new tab when isMet is true', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const activity = {
      type: 'Public Comment Period',
      project: { _id: 'proj1', name: 'Test Project' },
      pcp: { _id: 'pcp1', isMet: true, metURL: 'https://engage.example.com' }
    };

    component.goToCP(activity);

    expect(openSpy).toHaveBeenCalledWith('https://engage.example.com', '_blank');
    openSpy.mockRestore();
  });

  it('goToCP opens no ENGAGE link for an unsafe metURL and shows the period page', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const activity = {
      type: 'Public Comment Period',
      project: { _id: 'proj1', name: 'Test Project' },
      pcp: { _id: 'pcp1', isMet: true, metURL: 'javascript:alert(1)' }
    };

    component.goToCP(activity);

    expect(openSpy).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['p', 'proj1', 'cp', 'pcp1']);
    openSpy.mockRestore();
  });
});

/** Old updates link eagle-api document routes, which no longer serve public reads. */
describe('ActivityCardComponent legacy document links', () => {
  const ID = '5c8a7b6d5e4f3a2b1c0d9e8f';
  const DEMI = `/demi-search/documents/${ID}/download?redirect=1&inline=1`;

  function create(rowData: any): ComponentFixture<ActivityCardComponent> {
    TestBed.configureTestingModule({
      imports: [ActivityCardComponent],
      providers: [provideRouter([]), { provide: AnalyticsService, useValue: mockAnalyticsService }]
    });
    const fixture = TestBed.createComponent(ActivityCardComponent);
    fixture.componentRef.setInput('rowData', rowData);
    fixture.detectChanges();
    return fixture;
  }

  function render(rowData: any): HTMLElement {
    return create(rowData).nativeElement;
  }

  it('points the document button at the inline DEMI download', () => {
    const el = render({ headline: 'Update', documentUrl: `/api/public/document/${ID}/download/r.pdf` });
    expect(el.querySelector('a.btn')?.getAttribute('href')).toBe(DEMI);
  });

  it('points a link in the update text at the inline DEMI download', () => {
    const el = render({ headline: 'Update', content: `<p>See <a href="/api/document/${ID}/fetch">the report</a></p>` });
    expect(el.querySelector('p a')?.getAttribute('href')).toBe(DEMI);
  });

  it('drops script and event handler markup from the update text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = render({ headline: 'Update', content: '<p>Hi<script>alert(1)</script><img src="x.png" onerror="alert(2)"></p>' });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('p img')?.hasAttribute('onerror')).toBe(false);
    expect(el.querySelector('p')?.textContent).toBe('Hi');
    warn.mockRestore();
  });

  it('rewrites the update text once per row, not on every check', () => {
    const fixture = create({ headline: 'Update', content: `<p><a href="/api/document/${ID}/fetch">r</a></p>` });
    const searchPath = vi.spyOn(TestBed.inject(ConfigService), 'getSearchApiPath');
    fixture.detectChanges();
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
    expect(searchPath).not.toHaveBeenCalled();
  });
});
