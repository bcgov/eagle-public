import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
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

  // ─── getSafeHtml ──────────────────────────────────────────────────────────

  it('getSafeHtml strips Word HTML via sanitizeWordHtml', () => {
    const wordHtml = '<p class="MsoNormal" style="margin: 0;">Hello world.</p>';
    const result = component.getSafeHtml(wordHtml);
    // sanitizeWordHtml removes class and style; result is SafeHtml wrapping '<p>Hello world.</p>'
    expect(String(result)).not.toContain('MsoNormal');
    expect(String(result)).not.toContain('margin');
  });

  it('getSafeHtml handles null/undefined content', () => {
    expect(() => component.getSafeHtml(null as any)).not.toThrow();
    expect(() => component.getSafeHtml(undefined as any)).not.toThrow();
  });

  it('getSafeHtml preserves clean HTML', () => {
    const clean = '<p>Clean paragraph.</p>';
    const result = component.getSafeHtml(clean);
    expect(String(result)).toContain('Clean paragraph.');
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

  // ─── isExternalUrl ────────────────────────────────────────────────────────

  it('isExternalUrl returns true for https:// URL', () => {
    component.rowData = { documentUrl: 'https://example.gov.bc.ca/doc' };
    expect(component.isExternalUrl()).toBe(true);
  });

  it('isExternalUrl returns true for http:// URL', () => {
    component.rowData = { documentUrl: 'http://example.com/doc.pdf' };
    expect(component.isExternalUrl()).toBe(true);
  });

  it('isExternalUrl returns false for internal API doc path', () => {
    component.rowData = { documentUrl: '/api/document/abc123abc123abc123abc123/fetch/file.pdf' };
    expect(component.isExternalUrl()).toBe(false);
  });

  it('isExternalUrl returns false for folder URL', () => {
    component.rowData = { documentUrl: '/some/path/docs?folder=abc' };
    expect(component.isExternalUrl()).toBe(false);
  });

  it('isExternalUrl returns false for null documentUrl', () => {
    component.rowData = { documentUrl: null };
    expect(component.isExternalUrl()).toBe(false);
  });

  it('isExternalUrl returns false when rowData is null', () => {
    component.rowData = null;
    expect(component.isExternalUrl()).toBe(false);
  });

  // ─── hasDocContent ────────────────────────────────────────────────────────

  it('hasDocContent returns true for internal API doc path with 24-hex ObjectId', () => {
    component.rowData = { documentUrl: '/api/document/aabbccddeeff001122334455/fetch/report.pdf' };
    expect(component.hasDocContent()).toBe(true);
  });

  it('hasDocContent returns false for external URL (docId null)', () => {
    component.rowData = { documentUrl: 'https://example.com/doc' };
    expect(component.hasDocContent()).toBe(false);
  });

  it('hasDocContent returns true for folder URL when project._id present', () => {
    component.rowData = { documentUrl: '/docs?folder=abc', project: { _id: 'proj1' } };
    expect(component.hasDocContent()).toBe(true);
  });

  it('hasDocContent returns false for folder URL when no project', () => {
    component.rowData = { documentUrl: '/docs?folder=abc', project: null };
    expect(component.hasDocContent()).toBe(false);
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
});
