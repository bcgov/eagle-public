import { Fragment, useMemo, type ReactNode } from 'react';
import { useExtendedPage } from '../project-context';
import { ContentLink } from './content-link';
import type { AutoLink, InlineLink, RichText } from './types';

/** `term` as a literal inside a regular expression. */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One capturing alternation of every term, longest first so a term never loses to one it contains,
 * matched in any case and only as whole words. Null when there is nothing to link.
 */
function termPattern(links: AutoLink[]): RegExp | null {
  const terms = links
    .map((link) => link.text)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return null;
  // Lookarounds rather than \b, which never matches beside a term that starts or ends in punctuation.
  const word = '[\\p{L}\\p{N}_]';
  return new RegExp(`(?<!${word})(${terms.map(escapeRegExp).join('|')})(?!${word})`, 'iu');
}

/**
 * Each term's address for this piece of copy, keyed by the term in lower case: its `cited` one when
 * the copy mentions the match. Terms and matches both compare in any case.
 */
function hrefsFor(links: AutoLink[], parts: (string | InlineLink)[]): Map<string, string> {
  const copy = parts
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return new Map(
    links.map((link) => [
      link.text.toLowerCase(),
      link.cited && copy.includes(link.cited.match.toLowerCase()) ? link.cited.href : link.href,
    ]),
  );
}

function linkTerms(
  text: string,
  pattern: RegExp,
  hrefs: Map<string, string>,
  linked: Set<string>,
): ReactNode[] {
  // A capturing split leaves each term at an odd index.
  return text.split(pattern).map((part, index) => {
    const term = part.toLowerCase();
    if (index % 2 === 0 || linked.has(term)) return part;
    linked.add(term);
    return (
      <ContentLink key={index} href={hrefs.get(term) ?? ''}>
        {part}
      </ContentLink>
    );
  });
}

/**
 * Running copy with the first mention of each of the page's `autoLinks` terms linked, and any
 * explicit links in it kept. Outside an extended page, or with no `autoLinks`, nothing is added.
 */
export function RichTextView({ text }: { text: RichText }) {
  const links = useExtendedPage()?.autoLinks;
  const pattern = useMemo(() => (links ? termPattern(links) : null), [links]);
  const parts = typeof text === 'string' ? [text] : text;
  const hrefs = links && pattern ? hrefsFor(links, parts) : null;
  const linked = new Set<string>();
  return (
    <>
      {parts.map((part, index) =>
        typeof part !== 'string' ? (
          <ContentLink key={index} href={part.href}>
            {part.text}
          </ContentLink>
        ) : (
          <Fragment key={index}>
            {pattern && hrefs ? linkTerms(part, pattern, hrefs, linked) : part}
          </Fragment>
        ),
      )}
    </>
  );
}
