import { Fragment, useMemo, type ReactNode } from 'react';
import { useExtendedPage } from '../project-context';
import { ContentLink } from './content-link';
import type { AutoLink, InlineLink, RichText } from './types';

/** `term` as a literal inside a regular expression. */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `alternatives` matched in any case and only as whole words, or null where the browser cannot
 * build it (lookbehind and `\p{}` need Safari 16.4).
 */
function wholeWords(alternatives: string[], flags: string): RegExp | null {
  // Lookarounds rather than \b, which never matches beside a term that starts or ends in punctuation.
  const word = '[\\p{L}\\p{N}_]';
  try {
    return new RegExp(`(?<!${word})(?:${alternatives.join('|')})(?!${word})`, `iu${flags}`);
  } catch {
    return null;
  }
}

/** The terms to link, longest first so a term never loses to one it contains, with their pattern. */
interface Terms {
  links: AutoLink[];
  /** One group per entry of `links`, so the group that matched names the link. */
  pattern: RegExp;
}

function termsFor(autoLinks: AutoLink[]): Terms | null {
  // A stable sort keeps the first listed of two terms equal apart from case ahead, so it wins.
  const links = autoLinks.filter((link) => link.text).sort((a, b) => b.text.length - a.text.length);
  if (!links.length) return null;
  const pattern = wholeWords(
    links.map((link) => `(${escapeRegExp(link.text)})`),
    'g',
  );
  return pattern && { links, pattern };
}

/** Each term's address for this piece of copy: its `cited` one when the copy mentions the match. */
function hrefsFor(links: AutoLink[], parts: (string | InlineLink)[]): string[] {
  const copy = parts.filter((part): part is string => typeof part === 'string').join(' ');
  return links.map((link) =>
    link.cited && wholeWords([escapeRegExp(link.cited.match)], '')?.test(copy)
      ? link.cited.href
      : link.href,
  );
}

function linkTerms(
  text: string,
  pattern: RegExp,
  hrefs: string[],
  linked: Set<number>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const term = match.slice(1).findIndex((group) => group !== undefined);
    if (linked.has(term)) continue;
    linked.add(term);
    nodes.push(
      text.slice(end, match.index),
      <ContentLink key={match.index} href={hrefs[term]}>
        {match[0]}
      </ContentLink>,
    );
    end = match.index + match[0].length;
  }
  nodes.push(text.slice(end));
  return nodes;
}

/**
 * Running copy with the first mention of each of the page's `autoLinks` terms linked, and any
 * explicit links in it kept. Outside an extended page, or with no `autoLinks`, nothing is added.
 */
export function RichTextView({ text }: { text: RichText }) {
  const autoLinks = useExtendedPage()?.autoLinks;
  const terms = useMemo(() => (autoLinks ? termsFor(autoLinks) : null), [autoLinks]);
  const parts = typeof text === 'string' ? [text] : text;
  const hrefs = terms && hrefsFor(terms.links, parts);
  const linked = new Set<number>();
  return (
    <>
      {parts.map((part, index) =>
        typeof part !== 'string' ? (
          <ContentLink key={index} href={part.href}>
            {part.text}
          </ContentLink>
        ) : (
          <Fragment key={index}>
            {terms && hrefs ? linkTerms(part, terms.pattern, hrefs, linked) : part}
          </Fragment>
        ),
      )}
    </>
  );
}
