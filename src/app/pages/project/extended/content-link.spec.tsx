import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ContentLink } from './content-link';

/** Renders the link at `/` in a router shaped like the app's: project pages, then a catch-all. */
function renderLink(href: string, className?: string) {
  const router = createMemoryRouter([
    {
      path: '/',
      children: [
        {
          index: true,
          element: (
            <ContentLink href={href} className={className}>
              Read more
            </ContentLink>
          ),
        },
        { path: 'p/:projId/*', element: <p>Project page</p> },
        { path: '*', element: <p>Sent home</p> },
      ],
    },
  ]);
  return { router, ...render(<RouterProvider router={router} />) };
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

  it('links a site path the app routes in the app', () => {
    const { router } = renderLink('/p/abc/act');

    const link = screen.getByRole('link', { name: 'Read more' });
    expect(link).toHaveAttribute('href', '/p/abc/act');
    expect(link).not.toHaveAttribute('target');
    fireEvent.click(link);
    expect(router.state.location.pathname).toBe('/p/abc/act');
  });

  it.each(['/assets/report.pdf', '/api/public/document/abc/download'])(
    'leaves %s, which only the catch-all route takes, to the browser',
    (href) => {
      const { router } = renderLink(href);

      const link = screen.getByRole('link', { name: 'Read more' });
      expect(link).toHaveAttribute('href', href);
      // jsdom cannot load a document; cancel the click once it has passed React's handlers.
      const cancel = (event: Event) => event.preventDefault();
      window.addEventListener('click', cancel);
      fireEvent.click(link);
      window.removeEventListener('click', cancel);
      expect(router.state.location.pathname).toBe('/');
    },
  );

  it('keeps the class on a refused href, so a styled action keeps its look', () => {
    renderLink('javascript:alert(1)', 'project-masthead__action');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Read more')).toHaveClass('project-masthead__action');
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
    'mailto:office@example.com?cc=other@example.com',
    'mailto:office@example.com?subject=Hi&bcc=other@example.com',
    'mailto:office@example.com?body=Hi',
    'https://gov.bc.ca@other.example/',
    'https://:pw@example.com/',
    '',
  ])('renders plain text for the unsafe href "%s"', (href) => {
    renderLink(href);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Read more')).toBeInTheDocument();
  });
});
