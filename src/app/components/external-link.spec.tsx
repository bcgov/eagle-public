import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExternalLink } from './external-link';

describe('ExternalLink', () => {
  it('opens in a new tab without handing the new page a window.opener', () => {
    render(<ExternalLink href="https://example.com/act">The Act</ExternalLink>);

    // jsdom's name computation drops the space before the hidden span; browsers keep it.
    const link = screen.getByRole('link', { name: /^The Act\s*\(opens in new tab\)$/ });
    expect(link).toHaveAttribute('href', 'https://example.com/act');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('wraps the label, and only the label, in .link-label so the icon is not underlined', () => {
    render(
      <ExternalLink href="https://example.com/act" className="about-link">
        The Act
      </ExternalLink>,
    );

    const label = screen.getByText('The Act');
    expect(label).toHaveClass('link-label');
    expect(label).not.toContainElement(screen.getByText('open_in_new'));
    expect(screen.getByRole('link')).toHaveClass('about-link');
  });
});
