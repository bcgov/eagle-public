import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ExtendedPageContext } from '../project-context';
import { RichTextView } from './rich-text';
import type { AutoLink, ExtendedPage } from './types';

const BCA = 'https://laws.example/bca/';
const EAA = 'https://laws.example/eaa/';
const FISHERIES = 'https://laws.example/fisheries/';

const AUTO_LINKS: AutoLink[] = [
  { text: 'Building Canada Act', href: BCA },
  {
    text: 'Environmental Assessment Act',
    href: EAA,
    cited: { match: 'section 41', href: `${EAA}#section41` },
  },
  { text: 'Fisheries Act', href: FISHERIES },
  // Regular expression metacharacters, which must match literally.
  { text: 'Act (No. 2)', href: 'https://laws.example/no-2/' },
  { text: 'C++ Act', href: 'https://laws.example/cpp/' },
];

/** Renders inside a page whose content carries `autoLinks`. */
function renderOnPage(ui: ReactNode, content: Partial<ExtendedPage> = { autoLinks: AUTO_LINKS }) {
  const page = { version: 1, ...content } as ExtendedPage;
  return render(<ExtendedPageContext value={page}>{ui}</ExtendedPageContext>);
}

/** Links whose name starts with `name`; ExternalLink adds a new-tab hint to the name. */
function termLinks(name: string): HTMLElement[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return screen.queryAllByRole('link', { name: new RegExp(`^${escaped}`) });
}

describe('RichTextView', () => {
  it('links the first mention of a term and leaves the second as text', () => {
    renderOnPage(
      <p>
        <RichTextView text="The Building Canada Act lists projects. The Building Canada Act sets no time limits." />
      </p>,
    );

    expect(termLinks('Building Canada Act')).toHaveLength(1);
    expect(termLinks('Building Canada Act')[0]).toHaveAttribute('href', BCA);
    // The second mention still reads, as plain text.
    expect(
      screen.getByText(/projects\. The Building Canada Act sets no time limits\.$/),
    ).toBeInTheDocument();
  });

  it('opens the linked term in a new tab without handing it the opener', () => {
    renderOnPage(<RichTextView text="Listed under the Building Canada Act." />);

    const link = termLinks('Building Canada Act')[0];
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links each different term once', () => {
    renderOnPage(
      <RichTextView text="Permits under the Fisheries Act and the Building Canada Act, and again the Fisheries Act." />,
    );

    expect(termLinks('Fisheries Act')).toHaveLength(1);
    expect(termLinks('Fisheries Act')[0]).toHaveAttribute('href', FISHERIES);
    expect(termLinks('Building Canada Act')).toHaveLength(1);
  });

  it('counts a mention in an earlier part of the same text as the first', () => {
    renderOnPage(
      <RichTextView
        text={[
          'Under the Building Canada Act, ',
          { text: 'the MPO', href: 'https://www.canada.ca/mpo' },
          ' leads; the Building Canada Act ends in one document.',
        ]}
      />,
    );

    expect(termLinks('Building Canada Act')).toHaveLength(1);
  });

  it('links the term again in a separate piece of copy', () => {
    renderOnPage(
      <>
        <p>
          <RichTextView text="First paragraph on the Building Canada Act." />
        </p>
        <p>
          <RichTextView text="Second paragraph on the Building Canada Act." />
        </p>
      </>,
    );

    expect(termLinks('Building Canada Act')).toHaveLength(2);
  });

  it('keeps an explicit link in the copy as a new-tab link to its own address', () => {
    renderOnPage(
      <RichTextView
        text={['Built by ', { text: 'Trans Mountain Corporation', href: 'https://tmc.example/' }]}
      />,
    );

    const link = screen.getByRole('link', { name: /^Trans Mountain Corporation/ });
    expect(link).toHaveAttribute('href', 'https://tmc.example/');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('sends a term to its cited address when the copy mentions the match, in any case', () => {
    renderOnPage(
      <RichTextView text="Section 41 of B.C.'s Environmental Assessment Act allows an agreement." />,
    );

    expect(termLinks('Environmental Assessment Act')[0]).toHaveAttribute(
      'href',
      `${EAA}#section41`,
    );
  });

  it('sends the term to its own address otherwise', () => {
    renderOnPage(<RichTextView text="B.C.'s Environmental Assessment Act still applies." />);

    expect(termLinks('Environmental Assessment Act')[0]).toHaveAttribute('href', EAA);
  });

  it('adds no link to copy that names no term', () => {
    renderOnPage(<RichTextView text="The Environmental Assessment Office runs its own stages." />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('matches terms holding regular expression characters literally', () => {
    renderOnPage(
      <RichTextView text="Under the Act (No. 2), the C++ Act, and the Act No 2 and the C Act." />,
    );

    expect(termLinks('Act (No. 2)')).toHaveLength(1);
    expect(termLinks('Act (No. 2)')[0]).toHaveAttribute('href', 'https://laws.example/no-2/');
    expect(termLinks('C++ Act')).toHaveLength(1);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('links a term only as whole words, also where the term ends in punctuation', () => {
    renderOnPage(
      <RichTextView text="The Fisheries Acts, the SubFisheries Act, Act (No. 2)x and the C++ Act." />,
    );

    expect(termLinks('Fisheries Act')).toHaveLength(0);
    expect(termLinks('Act (No. 2)')).toHaveLength(0);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      'https://laws.example/cpp/',
    ]);
  });

  it('prefers the longer of two terms where one contains the other', () => {
    renderOnPage(
      <RichTextView text="Under the Fisheries Act Amendment, then the Fisheries Act." />,
      {
        autoLinks: [
          { text: 'Fisheries Act', href: FISHERIES },
          { text: 'Fisheries Act Amendment', href: 'https://laws.example/amendment/' },
        ],
      },
    );

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      'https://laws.example/amendment/',
      FISHERIES,
    ]);
  });

  it('matches a term in any case, as its cited match does, and links it once', () => {
    renderOnPage(<RichTextView text="The fisheries act and then the Fisheries Act." />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /^fisheries act/ })).toHaveAttribute('href', FISHERIES);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', '//evil.example/', 'http://plain.example/'])(
    'keeps the words but drops the link for the unsafe address %s',
    (href) => {
      renderOnPage(
        <RichTextView text={['See ', { text: 'the source', href }, ' and the Fisheries Act.']} />,
        { autoLinks: [{ text: 'Fisheries Act', href }] },
      );

      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.getByText(/See the source and the Fisheries Act\./)).toBeInTheDocument();
    },
  );

  it('links nothing on a page with no autoLinks', () => {
    renderOnPage(<RichTextView text="Listed under the Building Canada Act." />, {});

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Listed under the Building Canada Act.')).toBeInTheDocument();
  });

  it('links nothing outside an extended page, and keeps explicit links', () => {
    render(
      <RichTextView
        text={[
          'Listed under the Building Canada Act by ',
          { text: 'the MPO', href: 'https://mpo.example/' },
        ]}
      />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /^the MPO/ })).toHaveAttribute(
      'href',
      'https://mpo.example/',
    );
  });
});
