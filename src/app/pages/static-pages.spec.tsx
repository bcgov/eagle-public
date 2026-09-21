import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../test-utils';
import { Legislation } from './legislation';
import { Process } from './process';
import { ComplianceOversight } from './compliance-oversight';
import { Contact } from './contact';
import { SearchHelp } from './search-help';

function renderPage(element: React.ReactElement) {
  return renderAt('/', [{ path: '/', element }]);
}

/** The band the page opens with: the shared masthead around its h1. */
function bandOf(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 1, name: title });
  const band = heading.closest('.page-masthead');
  expect(band, `${title} is not in the shared masthead`).not.toBeNull();
  return band as HTMLElement;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('static text pages', () => {
  const PAGES: [string, React.ReactElement, RegExp, string[]][] = [
    [
      'Legislation',
      <Legislation />,
      /^Learn about the legislation/,
      ['2002 Environmental Assessment Act', '2018 Environmental Assessment Act'],
    ],
    [
      'Process & Procedures',
      <Process />,
      /^Learn more about how the Environmental Assessment Office/,
      ['2002 Environmental Assessment Act', '2018 Environmental Assessment Act'],
    ],
    [
      'Compliance Oversight',
      <ComplianceOversight />,
      /^Learn about how we collaborate/,
      ['View Compliance & Enforcement Policies and Procedures'],
    ],
  ];

  for (const [title, element, lede, labels] of PAGES) {
    it(`${title} opens with the masthead, its lede and new-tab links`, () => {
      renderPage(element);

      const band = bandOf(title);
      expect(within(band).getByText(lede)).toBeInTheDocument();
      const links = within(band).getAllByRole('link');
      expect(links).toHaveLength(labels.length);
      labels.forEach((label, index) => {
        expect(links[index]).toHaveAccessibleName(
          new RegExp(`^${escape(label)}\\s*\\(opens in new tab\\)$`),
        );
        expect(links[index]).toHaveAttribute('target', '_blank');
        expect(links[index]).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  }

  it('keeps the body copy on the shared content width, not a centred column', () => {
    const { container } = renderPage(<Legislation />);

    expect(container.querySelector('.content-wrapper')?.parentElement).toHaveClass(
      'page-container',
    );
  });
});

describe('contact', () => {
  it('opens with the masthead and a same-tab feedback mail link', () => {
    renderPage(<Contact />);

    const feedback = within(bandOf('Connect With Us')).getByRole('link', {
      name: 'Submit your Feedback',
    });
    expect(feedback).toHaveAttribute('href', 'mailto:EAO.EPICsystem@gov.bc.ca');
    expect(feedback).not.toHaveAttribute('target');
  });
});

describe('search help', () => {
  it('opens with the masthead and no actions', () => {
    renderPage(<SearchHelp />);

    const band = bandOf('Advanced Search Help');
    expect(within(band).getByText(/^Learn some tips/)).toBeInTheDocument();
    expect(within(band).queryByRole('link')).not.toBeInTheDocument();
  });

  it('leaves the main landmark to the app shell', () => {
    renderPage(<SearchHelp />);

    expect(screen.getByRole('heading', { name: 'Quotes' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
