import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SiteFooter } from './site-footer';
import { adminUrl } from 'app/config/config';

function renderFooter() {
  return render(<SiteFooter />);
}

describe('site footer', () => {
  it('renders a contentinfo landmark with the land acknowledgement', () => {
    renderFooter();

    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByText(
        /The B\.C\. Public Service acknowledges the territories of First Nations around B\.C\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(footer).getByText(
        /all Indigenous Peoples — First Nations, Métis, and Inuit — respecting and acknowledging their distinct cultures, histories, rights, laws, and governments\./,
      ),
    ).toBeInTheDocument();
  });

  it('links the seven standard gov.bc.ca pages', () => {
    renderFooter();

    const expected = [
      ['Home', 'https://www2.gov.bc.ca/gov/content/home'],
      ['About gov.bc.ca', 'https://www2.gov.bc.ca/gov/content/about-gov-bc-ca'],
      ['Disclaimer', 'https://www2.gov.bc.ca/gov/content/home/disclaimer'],
      ['Privacy', 'https://www2.gov.bc.ca/gov/content/home/privacy'],
      ['Accessibility', 'https://www2.gov.bc.ca/gov/content/home/accessible-government'],
      ['Copyright', 'https://www2.gov.bc.ca/gov/content/home/copyright'],
      ['Contact us', 'https://www2.gov.bc.ca/gov/content/home/get-help-with-government-services'],
    ];

    for (const [name, href] of expected) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('sends Admin Login to the configured admin app in a new tab, last in the menu', () => {
    renderFooter();

    const admin = screen.getByRole('link', { name: 'Admin Login' });
    expect(admin).toHaveAttribute('href', adminUrl());
    expect(admin).toHaveAttribute('target', '_blank');
    expect(admin).toHaveAttribute('rel', 'noopener');
    // The GTM tag the analytics container listens for.
    expect(admin).toHaveClass('gtm-admin-login');

    const menu = screen.getByRole('list');
    const names = within(menu)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(names).toHaveLength(8);
    expect(names.at(-1)).toBe('Admin Login');
  });

  it('shows the current year in the copyright line', () => {
    renderFooter();

    const year = new Date().getUTCFullYear();
    expect(screen.getByText(`© ${year} Government of British Columbia.`)).toBeInTheDocument();
  });
});
