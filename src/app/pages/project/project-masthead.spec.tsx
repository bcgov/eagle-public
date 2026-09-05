import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig, type EnvConfig } from 'app/config/config';
import type { Project } from 'app/models/project';
import { clearToasts, useToasts } from 'app/state/toast';
import { renderAt } from '../../../test-utils';
import { ProjectMasthead } from './project-masthead';

/** jsdom leaves a popover `display: none`, so queries pass `hidden: true`. */
const user = userEvent.setup({ pointerEventsCheck: 0 });

const PROJECT = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  proponent: { name: 'Cedar Quarry Partners LP' },
  location: 'Near Cedar Creek',
} as unknown as Project;

async function renderMasthead(
  project: Project | null = PROJECT,
  loading = false,
  envOverrides: Partial<EnvConfig> = {},
) {
  window.__env = { logLevel: 4, NOTIFY_API: 'https://notify.example', ...envOverrides };
  await loadConfig();
  return renderAt('/p/proj-1/overview', [
    {
      path: '/p/:projId/overview',
      element: <ProjectMasthead project={project} projId="proj-1" loading={loading} />,
    },
  ]);
}

describe('project masthead', () => {
  const toasts = () => renderHook(() => useToasts()).result.current;

  afterEach(() => {
    vi.unstubAllGlobals();
    clearToasts();
  });

  it('names the project and the trail that leads to it', async () => {
    await renderMasthead();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cedar Quarry');
    expect(screen.getByText('Cedar Quarry Partners LP · Near Cedar Creek')).toBeInTheDocument();

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getAllByRole('link')).toHaveLength(1);
    expect(within(crumbs).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
    expect(within(crumbs).getByText('Cedar Quarry')).toHaveAttribute('aria-current', 'page');
  });

  it('offers a Subscribe button that opens this project subscription form', async () => {
    const { container } = await renderMasthead();

    const trigger = screen.getByRole('button', { name: 'Subscribe to updates' });
    expect(container.querySelector('.subscribe-popover')).toHaveAttribute(
      'data-service',
      'project:proj-1',
    );

    const panel = document.getElementById(trigger.getAttribute('popovertarget') ?? '');
    expect(panel).toHaveAttribute('popover', 'auto');
    expect(panel).toHaveAttribute('role', 'dialog');

    // jsdom never opens a popover, so the wiring is what proves the button reaches the form.
    expect(trigger).toHaveAttribute('popovertarget', panel!.id);
    await user.click(trigger);
    expect(
      within(panel!).getByRole('heading', { name: 'Email updates for this project', hidden: true }),
    ).toBeInTheDocument();
  });

  it('shows a loading placeholder instead of the name and the sub-line while the project is in flight', async () => {
    const { container } = await renderMasthead(null, true);

    expect(screen.getByText('Loading project')).toBeInTheDocument();
    expect(container.querySelector('h1 .placeholder')).toBeInTheDocument();
    expect(container.querySelector('.project-masthead__meta .placeholder')).toBeInTheDocument();
  });

  it('copies the project link and shows an in-button copied state instead of a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await renderMasthead();

    await user.click(screen.getByRole('button', { name: 'Short link' }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/p/proj-1`);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Link copied to clipboard');
    expect(toasts()).toEqual([]);

    // The copied state holds for 2s before it reverts; real timers, so give waitFor the room.
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Short link' })).toBeInTheDocument(),
      {
        timeout: 3000,
      },
    );
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('copies the DEMI short link once demi-api provides one, instead of the /p/ fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const shortUrl = 'https://projects.eao.gov.bc.ca/s/abcd2345';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ shortUrl }), { status: 200 })),
    );

    const { queryClient } = await renderMasthead(PROJECT, false, {
      DEMI_PROJECTS_PATH: '/demi-projects',
    });
    await waitFor(() =>
      expect(queryClient.getQueryData(['demi-project', 'proj-1'])).toEqual({ shortUrl }),
    );

    await user.click(screen.getByRole('button', { name: 'Short link' }));

    expect(writeText).toHaveBeenCalledWith(shortUrl);
  });

  it('falls back to execCommand when the clipboard API is unavailable, with no toast', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    // jsdom has no execCommand at all; add it directly rather than stubbing the whole document.
    document.execCommand = execCommand;
    await renderMasthead();

    await user.click(screen.getByRole('button', { name: 'Short link' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(toasts()).toEqual([]);

    delete (document as Partial<Document>).execCommand;
  });

  it('toasts the link to copy by hand when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await renderMasthead();

    await user.click(screen.getByRole('button', { name: 'Short link' }));

    await waitFor(() =>
      expect(toasts().map((toast) => toast.message)).toEqual([
        `Copy this link: ${window.location.origin}/p/proj-1`,
      ]),
    );
  });
});
