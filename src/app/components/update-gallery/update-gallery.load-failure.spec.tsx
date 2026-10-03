import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateImage } from 'app/api/updates';
import { logger } from 'app/config/logging';
import { UpdateGallery } from './update-gallery';

// The viewer chunk fails to load, as a stale chunk does after a deploy.
vi.mock('./update-lightbox', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

const PHOTOS: UpdateImage[] = ['a', 'b'].map((id) => ({
  id,
  src: `/demi-search/documents/${id}/download?redirect=1`,
  alt: `Alt ${id}`,
  caption: null,
  credit: null,
}));

describe('UpdateGallery when the viewer cannot load', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the page and its photos, and logs the failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <main>
        <h2>Update headline</h2>
        <UpdateGallery images={PHOTOS} headingLevel={3} />
      </main>,
    );

    await user.click(screen.getByRole('button', { name: 'Alt a' }));

    await waitFor(() =>
      expect(logged).toHaveBeenCalledWith(
        'The photo viewer could not load',
        'UpdateGallery',
        expect.any(Error),
      ),
    );
    expect(screen.getByRole('heading', { name: 'Update headline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alt b' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the failed viewer, so the next photo opened tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<UpdateGallery images={PHOTOS} headingLevel={3} />);

    await user.click(screen.getByRole('button', { name: 'Alt a' }));
    await waitFor(() => expect(logged).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Alt b' }));

    // A viewer left open in its failed state would swallow the second open silently.
    await waitFor(() => expect(logged).toHaveBeenCalledTimes(2));
  });
});
