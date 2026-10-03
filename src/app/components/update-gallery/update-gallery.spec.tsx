import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateImage } from 'app/api/updates';
import { ImageCaption, UpdateGallery } from './update-gallery';

function photo(id: string, extra: Partial<UpdateImage> = {}): UpdateImage {
  return {
    id,
    src: `/demi-search/documents/${id}/download?redirect=1`,
    alt: `Alt ${id}`,
    caption: null,
    credit: null,
    ...extra,
  };
}

const viewer = () => screen.queryByRole('dialog', { name: 'Lightbox' });

describe('ImageCaption', () => {
  it('renders nothing for a photo with neither caption nor credit', () => {
    render(
      <figure>
        <ImageCaption image={photo('a')} />
      </figure>,
    );

    expect(screen.getByRole('figure')).toBeEmptyDOMElement();
  });

  it('names the figure with the caption and the credit', () => {
    render(
      <figure>
        <ImageCaption image={photo('a', { caption: 'The intake', credit: 'EAO staff' })} />
      </figure>,
    );

    expect(screen.getByRole('figure')).toHaveTextContent('The intakePhoto: EAO staff');
  });

  it('shows a credit alone, prefixed', () => {
    render(
      <figure>
        <ImageCaption image={photo('a', { credit: 'EAO staff' })} />
      </figure>,
    );

    expect(screen.getByRole('figure')).toHaveTextContent(/^Photo: EAO staff$/);
  });

  it('shows a caption alone, with no credit line', () => {
    render(
      <figure>
        <ImageCaption image={photo('a', { caption: 'The intake' })} />
      </figure>,
    );

    expect(screen.getByRole('figure')).toHaveTextContent(/^The intake$/);
  });
});

describe('UpdateGallery', () => {
  it('renders nothing, not even its heading, for an Update with no photos', () => {
    const { container } = render(<UpdateGallery images={[]} headingLevel={3} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no photo has a safe address', () => {
    const { container } = render(
      <UpdateGallery images={[photo('a', { src: 'javascript:alert(1)' })]} headingLevel={3} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('heads the photos at the level its host asks for', () => {
    const { unmount } = render(<UpdateGallery images={[photo('a')]} headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Photos' })).toBeInTheDocument();
    unmount();

    render(<UpdateGallery images={[photo('a')]} headingLevel={4} />);
    expect(screen.getByRole('heading', { level: 4, name: 'Photos' })).toBeInTheDocument();
  });

  it('sizes the grid to the number of safe photos', () => {
    render(
      <UpdateGallery
        images={[photo('a'), photo('b', { src: '//evil.example/x.jpg' }), photo('c')]}
        headingLevel={3}
      />,
    );

    // The grid layout itself is CSS; the e2e run checks it. This is the hook the CSS keys on.
    expect(screen.getByRole('list')).toHaveClass('update-gallery__grid--2');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('names each photo button by its alt text, or by position when it has none', () => {
    render(<UpdateGallery images={[photo('a'), photo('b', { alt: '' })]} headingLevel={3} />);

    expect(screen.getByRole('button', { name: 'Alt a' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photo 2 of 2' })).toBeInTheDocument();
  });

  it('opens the viewer at the photo clicked', async () => {
    const user = userEvent.setup();
    render(
      <UpdateGallery
        images={[photo('a'), photo('b', { caption: 'Second photo' })]}
        headingLevel={3}
      />,
    );

    expect(viewer()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Alt b' }));

    const dialog = await screen.findByRole('dialog', { name: 'Lightbox' });
    // The viewer keeps its neighbours mounted but inert; the photo on show is the one that is not.
    expect(within(dialog).getByRole('img', { name: 'Alt b' }).closest('[inert]')).toBeNull();
    expect(within(dialog).getByRole('img', { name: 'Alt a' }).closest('[inert]')).not.toBeNull();
    expect(dialog).toHaveTextContent('Second photo');
  });

  it('closes the viewer on Escape and returns focus to the photo opened', async () => {
    const user = userEvent.setup();
    render(<UpdateGallery images={[photo('a'), photo('b')]} headingLevel={3} />);

    const thumb = screen.getByRole('button', { name: 'Alt a' });
    await user.click(thumb);
    await screen.findByRole('dialog', { name: 'Lightbox' });
    await waitFor(() => expect(thumb).not.toHaveFocus());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(viewer()).toBeNull());
    expect(thumb).toHaveFocus();
  });

  it('inside a modal dialog, opens the viewer within it, not behind it', async () => {
    const user = userEvent.setup();
    render(
      <dialog aria-label="Update reader" open>
        <UpdateGallery images={[photo('a')]} headingLevel={3} />
      </dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Alt a' }));

    // A modal dialog makes the rest of the page inert, so a viewer on document.body is unusable.
    expect(screen.getByRole('dialog', { name: 'Update reader' })).toContainElement(
      await screen.findByRole('dialog', { name: 'Lightbox' }),
    );
  });
});
