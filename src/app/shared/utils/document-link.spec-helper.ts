import { it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from 'app/services/analytics/analytics.service';

/** Text a screen reader announces for the link: aria-hidden parts left out, spacing collapsed. */
function accessibleName(link: HTMLElement): string {
  const copy = link.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Enter as a keyboard user presses it: both key events, bubbling to any row handler. */
export function pressEnter(element: HTMLElement): void {
  for (const type of ['keydown', 'keyup']) {
    element.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', bubbles: true }));
  }
}

/**
 * Cases for a row link that shows document `doc1` in a new tab. `render` builds the row in a fresh
 * TestBed and returns the link; the browser opens the tab, so no case may see `window.open`.
 */
export function itOpensDocumentInNewTab(render: () => HTMLAnchorElement): void {
  it('links to the stable inline document address in a new tab, and says so', () => {
    const link = render();
    expect(link.getAttribute('href')).toBe('/demi-search/documents/doc1/download?inline=1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.relList.contains('noopener')).toBe(true);
    expect(accessibleName(link)).toMatch(/\(opens in new tab\)$/);
  });

  it('records the open on click and leaves opening the tab to the link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const link = render();
    const track = vi.spyOn(TestBed.inject(AnalyticsService), 'track');

    link.click();

    expect(track).toHaveBeenCalledExactlyOnceWith('Document Opened', expect.objectContaining({ document_id: 'doc1' }));
    expect(open).not.toHaveBeenCalled();
  });

  it('opens no extra window when Enter is pressed on the link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    pressEnter(render());
    expect(open).not.toHaveBeenCalled();
  });
}
