/* eslint-disable react-refresh/only-export-components -- one marking module: the component and
   the two text helpers share the match scanner, and splitting them would duplicate it. */
import { Fragment } from 'react';
import './highlight.css';

/** Terms shorter than this match inside almost every word, so the row would be all highlight. */
const MIN_TERM_LENGTH = 2;

export interface ExcerptOptions {
  /** A hit at or before this offset is close enough to the top that the excerpt starts at 0. */
  window?: number;
  /** Characters of run-up kept in front of a later hit, so the match has context. */
  before?: number;
  /** How much text the excerpt carries. Matches the clamp length the list row uses. */
  length?: number;
}

/**
 * The keyword as match terms: whitespace-separated words with quotes stripped. Quoted phrases are
 * a search-side concept — the API decides what a `"exact phrase"` matches, and the highlight only
 * has to mark the words that came back.
 */
export function toTerms(keyword: string | undefined): string[] {
  if (!keyword) return [];
  const terms: string[] = [];
  for (const word of keyword.split(/\s+/)) {
    const stripped = word.replace(/["']/g, '').trim();
    if (stripped.length >= MIN_TERM_LENGTH && !terms.includes(stripped)) {
      terms.push(stripped);
    }
  }
  return terms;
}

interface Span {
  from: number;
  to: number;
}

/** Every match of every term, overlaps merged, in reading order. */
function matchSpans(text: string, terms: string[]): Span[] {
  const haystack = text.toLowerCase();
  const found: Span[] = [];

  for (const term of terms) {
    const needle = term.toLowerCase();
    if (needle.length < MIN_TERM_LENGTH) continue;
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      found.push({ from: at, to: at + needle.length });
      at = haystack.indexOf(needle, at + needle.length);
    }
  }

  found.sort((a, b) => a.from - b.from || a.to - b.to);

  const merged: Span[] = [];
  for (const span of found) {
    const last = merged[merged.length - 1];
    // Two terms that overlap ("sediment" and "diment") must not nest one <mark> inside another.
    if (last && span.from <= last.to) {
      last.to = Math.max(last.to, span.to);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

export interface HighlightProps {
  text: string;
  /** Already split by `toTerms`. Empty leaves the text untouched. */
  terms?: string[];
}

/**
 * Marks search hits in plain text. The text is split and rendered as React children, never as
 * injected HTML, so a record whose name contains markup stays text.
 */
export function Highlight({ text, terms }: HighlightProps) {
  const spans = terms && terms.length > 0 ? matchSpans(text, terms) : [];
  if (spans.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const span of spans) {
    // No whitespace or newlines between parts: a mid-word match must not gain a phantom space.
    if (span.from > at) parts.push(<Fragment key={`t${at}`}>{text.slice(at, span.from)}</Fragment>);
    parts.push(
      <mark key={`m${span.from}`} className="display-grid__hit">
        {text.slice(span.from, span.to)}
      </mark>,
    );
    at = span.to;
  }
  if (at < text.length) parts.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);

  return <>{parts}</>;
}

/**
 * A collapsed body starts at the first hit rather than at the top: a match buried in paragraph
 * three is no use if the row shows paragraph one. A hit already near the top leaves the excerpt
 * where it is, so the common case reads as the record was written.
 */
export function excerptAround(
  text: string,
  terms: string[] | undefined,
  options: ExcerptOptions = {},
): string {
  const { window = 140, before = 80, length = 260 } = options;
  const cut = (value: string, leading: boolean): string => {
    const tail = value.length > length ? '…' : '';
    return (leading ? '…' : '') + value.slice(0, length) + tail;
  };

  const spans = terms && terms.length > 0 ? matchSpans(text, terms) : [];
  const first = spans[0];
  if (!first || first.from <= window) return cut(text, false);

  const from = Math.max(0, first.from - before);
  return cut(text.slice(from), from > 0);
}
