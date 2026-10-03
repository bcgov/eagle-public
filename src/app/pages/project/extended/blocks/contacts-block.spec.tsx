import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';

describe('contacts block', () => {
  it('opens web contacts in a new tab and mail contacts in place', async () => {
    renderBlocks([
      {
        type: 'contacts',
        id: 'contact',
        heading: 'Contact',
        items: [
          { label: 'Bookings', link: { label: 'Book a room', href: 'https://example.org/book' } },
          {
            label: 'Library Board',
            link: { label: 'board@example.org', href: 'mailto:board@example.org' },
          },
        ],
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Contact' });
    expect(within(section).getByRole('link', { name: /^Book a room/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    const mail = within(section).getByRole('link', { name: 'board@example.org' });
    expect(mail).toHaveAttribute('href', 'mailto:board@example.org');
    expect(mail).not.toHaveAttribute('target');
    expect(within(section).getByText('Library Board')).toBeInTheDocument();
  });

  it('opens upper-case mail and phone contacts in place, and drops an unsafe link', async () => {
    renderBlocks([
      {
        type: 'contacts',
        id: 'contact',
        heading: 'Contact',
        items: [
          { label: 'Mail', link: { label: 'Write', href: 'MAILTO:board@example.org' } },
          { label: 'Phone', link: { label: 'Call', href: 'tel:+12505550100' } },
          { label: 'Other', link: { label: 'Run', href: 'javascript:alert(1)' } },
        ],
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Contact' });
    const links = within(section).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('target')])).toEqual([
      ['Write', null],
      ['Call', null],
    ]);
    expect(within(section).getByText('Run')).toBeInTheDocument();
  });
});
