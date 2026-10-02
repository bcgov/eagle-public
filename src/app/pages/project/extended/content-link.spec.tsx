import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ContentLink } from './content-link';

function renderLink(href: string) {
  const router = createMemoryRouter([
    { path: '*', element: <ContentLink href={href}>Read more</ContentLink> },
  ]);
  return render(<RouterProvider router={router} />);
}

describe('ContentLink', () => {
  it('opens an https page in a new tab without handing it the opener', () => {
    renderLink('https://example.com/page');

    const link = screen.getByRole('link', { name: /^Read more/ });
    expect(link).toHaveAttribute('href', 'https://example.com/page');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each(['mailto:office@example.com', 'MAILTO:office@example.com', 'tel:+12505550100'])(
    'opens %s in place',
    (href) => {
      renderLink(href);

      const link = screen.getByRole('link', { name: 'Read more' });
      expect(link).toHaveAttribute('href', href);
      expect(link).not.toHaveAttribute('target');
    },
  );

  it('links a site path in the app', () => {
    renderLink('/p/abc/act');

    const link = screen.getByRole('link', { name: 'Read more' });
    expect(link).toHaveAttribute('href', '/p/abc/act');
    expect(link).not.toHaveAttribute('target');
  });

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,hi',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'http://example.com/',
    '//example.com/',
    '/\\example.com/',
    '/\t/example.com/',
    '/\n/example.com/',
    '/\r/example.com/',
    'page.html',
    '',
  ])('renders plain text for the unsafe href "%s"', (href) => {
    renderLink(href);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Read more')).toBeInTheDocument();
  });
});
