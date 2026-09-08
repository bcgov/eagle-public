import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { logger } from 'app/config/logging';
import { renderAt } from '../../test-utils';
import { EngagementLink } from './engagement-link';

interface LinkProps {
  isMet?: boolean;
  metURL?: string | null;
  to?: string | null;
  onClick?: () => void;
}

function renderLink(props: LinkProps) {
  return renderAt('/start', [
    {
      path: '/start',
      element: <EngagementLink {...props} label="View Engagement" />,
    },
    { path: '/p/:projId/cp/:cpId', element: <p>comment period page</p> },
  ]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EngagementLink', () => {
  it('sends an ENGAGE-hosted period to its own site in a new tab', () => {
    renderLink({ isMet: true, metURL: 'https://engage.example/cedar', to: '/p/proj-1/cp/cp-1' });

    const link = screen.getByRole('link', { name: /View Engagement/ });
    expect(link).toHaveAttribute('href', 'https://engage.example/cedar');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('tells assistive tech about the new tab, and keeps the icon out of the name', () => {
    renderLink({ isMet: true, metURL: 'https://engage.example/cedar' });

    expect(
      screen.getByRole('link', { name: 'View Engagement (opens in new tab)' }),
    ).toBeInTheDocument();
    // The label still reads plainly on screen; only the icon carries no name of its own.
    expect(screen.getByText('View Engagement')).toBeInTheDocument();
    expect(screen.getByText('open_in_new')).toHaveAttribute('aria-hidden', 'true');
  });

  it('routes an EPIC-hosted period to its comment period page', async () => {
    const { router } = renderLink({ to: '/p/proj-1/cp/cp-1' });

    const link = screen.getByRole('link', { name: 'View Engagement' });
    expect(link).toHaveAttribute('href', '/p/proj-1/cp/cp-1');
    expect(link).not.toHaveAttribute('target');

    await userEvent.click(link);

    expect(router.state.location.pathname).toBe('/p/proj-1/cp/cp-1');
  });

  it('falls back to the EPIC route when the ENGAGE URL is not a scheme we allow', () => {
    const warn = vi.spyOn(logger, 'warn').mockReturnValue(undefined);

    renderLink({ isMet: true, metURL: 'javascript:alert(1)', to: '/p/proj-1/cp/cp-1' });

    expect(screen.getByRole('link', { name: 'View Engagement' })).toHaveAttribute(
      'href',
      '/p/proj-1/cp/cp-1',
    );
    expect(warn).toHaveBeenCalled();
  });

  it('renders nothing when the period has neither an ENGAGE URL nor a route', () => {
    vi.spyOn(logger, 'warn').mockReturnValue(undefined);

    renderLink({ isMet: true, metURL: '', to: null });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('View Engagement')).toBeNull();
  });

  it('reports the click to analytics before following the link', async () => {
    const onClick = vi.fn();
    renderLink({ to: '/p/proj-1/cp/cp-1', onClick });

    await userEvent.click(screen.getByRole('link', { name: 'View Engagement' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
