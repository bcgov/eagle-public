import { describe, it, expect } from 'vitest';
import { safeHtml } from './safe-html';

describe('safeHtml', () => {
  it('drops event handlers and scripts', () => {
    const { __html } = safeHtml(
      '<p>x</p><img src=x onerror="window.__pwned = true"><script>1</script>',
    );
    expect(__html).toBe('<p>x</p><img src="x">');
  });

  it('drops javascript: links', () => {
    expect(safeHtml('<a href="javascript:alert(1)">a</a>').__html).toBe('<a>a</a>');
  });

  it('keeps ordinary markup and link targets', () => {
    const html = '<p>Hello <b>world</b> <a href="https://x.gov.bc.ca" target="_blank">link</a></p>';
    expect(safeHtml(html).__html).toBe(html);
  });

  it('renders nothing for a missing value', () => {
    expect(safeHtml(undefined as unknown as string).__html).toBe('');
  });
});
