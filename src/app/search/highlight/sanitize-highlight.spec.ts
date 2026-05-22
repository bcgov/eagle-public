import { describe, it, expect } from 'vitest';
import { sanitizeHighlight, highlightText, escapeHtml } from './sanitize-highlight';

// ── sanitizeHighlight ──────────────────────────────────────────────────────────

describe('sanitizeHighlight', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHighlight('')).toBe('');
    expect(sanitizeHighlight(null as any)).toBe('');
    expect(sanitizeHighlight(undefined as any)).toBe('');
  });

  it('preserves <mark> and </mark> tags', () => {
    expect(sanitizeHighlight('foo <mark>bar</mark> baz')).toBe('foo <mark>bar</mark> baz');
  });

  it('preserves multiple <mark> spans', () => {
    const input = '<mark>one</mark> and <mark>two</mark>';
    expect(sanitizeHighlight(input)).toBe('<mark>one</mark> and <mark>two</mark>');
  });

  it('strips <script> tags (XSS protection)', () => {
    const input = 'safe <mark>match</mark> <script>alert(1)</script>';
    expect(sanitizeHighlight(input)).toBe('safe <mark>match</mark> alert(1)');
  });

  it('strips arbitrary HTML tags outside <mark>', () => {
    const input = '<b>bold</b> <mark>hit</mark> <em>italic</em>';
    expect(sanitizeHighlight(input)).toBe('bold <mark>hit</mark> italic');
  });

  it('decodes named HTML entities in text portions', () => {
    expect(sanitizeHighlight('drag&eacute;e')).toBe('dragée');
    expect(sanitizeHighlight('caf&eacute;')).toBe('café');
    expect(sanitizeHighlight('&amp; &lt; &gt;')).toBe('& < >');
  });

  it('decodes entities adjacent to <mark>', () => {
    const input = '<mark>tootsie</mark> roll drag&eacute;e';
    expect(sanitizeHighlight(input)).toBe('<mark>tootsie</mark> roll dragée');
  });

  it('decodes numeric decimal entities', () => {
    expect(sanitizeHighlight('&#233;')).toBe('é'); // é
  });

  it('decodes numeric hex entities', () => {
    expect(sanitizeHighlight('&#xE9;')).toBe('é'); // é
  });

  it('handles <MARK> and </MARK> case-insensitively', () => {
    expect(sanitizeHighlight('<MARK>test</MARK>')).toBe('<mark>test</mark>');
    expect(sanitizeHighlight('<Mark>test</Mark>')).toBe('<mark>test</mark>');
  });

  it('does NOT decode entities inside <mark> content (they are already text)', () => {
    // Typesense highlight content is already decoded; this just confirms no double-decode
    const input = '<mark>café</mark>';
    expect(sanitizeHighlight(input)).toBe('<mark>café</mark>');
  });

  it('returns plain text unchanged (no tags, no entities)', () => {
    expect(sanitizeHighlight('just plain text')).toBe('just plain text');
  });

  it('handles input with no <mark> (strips all HTML)', () => {
    expect(sanitizeHighlight('<p>hello <b>world</b></p>')).toBe('hello world');
  });
});

// ── highlightText ──────────────────────────────────────────────────────────────

describe('highlightText', () => {
  it('returns empty string for falsy text', () => {
    expect(highlightText('', 'query')).toBe('');
    expect(highlightText(null as any, 'query')).toBe('');
  });

  it('returns escaped text when query is empty', () => {
    expect(highlightText('hello & world', '')).toBe('hello &amp; world');
  });

  it('wraps matching tokens in <mark>', () => {
    expect(highlightText('the quick brown fox', 'quick')).toBe('the <mark>quick</mark> brown fox');
  });

  it('wraps multiple tokens', () => {
    const result = highlightText('the quick brown fox', 'quick fox');
    expect(result).toBe('the <mark>quick</mark> brown <mark>fox</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightText('Hello World', 'hello')).toBe('<mark>Hello</mark> World');
  });

  it('HTML-escapes text before highlighting (XSS prevention)', () => {
    const result = highlightText('<script>alert(1)</script> foo', 'foo');
    expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt; <mark>foo</mark>');
  });

  it('escapes special chars in user query (regex safety)', () => {
    // A query containing regex metacharacters must not throw
    const result = highlightText('price $10.00 and more', '$10.00');
    expect(result).toContain('<mark>$10.00</mark>');
  });

  it('handles multi-word query with extra whitespace', () => {
    const result = highlightText('foo bar baz', 'foo  baz');
    expect(result).toBe('<mark>foo</mark> bar <mark>baz</mark>');
  });
});

// ── escapeHtml ─────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes all special chars at once', () => {
    expect(escapeHtml('<b>"test" & \'stuff\'</b>'))
      .toBe('&lt;b&gt;&quot;test&quot; &amp; &#x27;stuff&#x27;&lt;/b&gt;');
  });

  it('coerces non-string input to string', () => {
    expect(escapeHtml(42 as any)).toBe('42');
  });
});
