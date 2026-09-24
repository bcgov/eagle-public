import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import type { UpdateImage } from 'app/api/updates';
import { logger } from 'app/config/logging';
import { isSafeUrl } from 'app/utils/safe-url';
import './update-gallery.css';

// The viewer and its stylesheet load on the first open, not with every Update.
const UpdateLightbox = lazy(() => import('./update-lightbox'));

/** A viewer chunk that fails to load (stale after a deploy, say) closes the viewer, not the page. */
class LightboxBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    logger.error('The photo viewer could not load', 'UpdateGallery', error);
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Caption and credit under an Update photo; nothing when it has neither. */
export function ImageCaption({ image }: { image: UpdateImage }) {
  if (!image.caption && !image.credit) return null;
  return (
    <figcaption className="update-gallery__caption">
      {image.caption}
      {image.credit && <span className="update-gallery__credit">Photo: {image.credit}</span>}
    </figcaption>
  );
}

/** An Update's photo series: a grid sized to the count, each photo opening a full-screen viewer. */
export function UpdateGallery({
  images,
  headingLevel,
}: {
  images: UpdateImage[];
  /** The host's own heading sets it: h3 under the reader's h2, h4 under a card's h3. */
  headingLevel: 3 | 4;
}) {
  const safe = images.filter((image) => isSafeUrl(image.src));
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  if (safe.length === 0) return null;

  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const close = () => setOpenAt(null);

  return (
    <div className="update-gallery">
      <Heading className="update-gallery__title">Photos</Heading>
      <ul className={`update-gallery__grid update-gallery__grid--${safe.length}`}>
        {safe.map((image, index) => (
          <li key={`${index}-${image.id}`}>
            <figure className="update-gallery__item">
              <button
                type="button"
                className="update-gallery__thumb"
                aria-haspopup="dialog"
                aria-label={image.alt ? undefined : `Photo ${index + 1} of ${safe.length}`}
                onClick={(event) => {
                  // Inside the reader's modal <dialog> the page is inert, so the viewer mounts there.
                  setPortalRoot(event.currentTarget.closest('dialog'));
                  setOpenAt(index);
                }}
              >
                <img src={image.src} alt={image.alt} loading="lazy" />
              </button>
              <ImageCaption image={image} />
            </figure>
          </li>
        ))}
      </ul>
      {openAt !== null && (
        <LightboxBoundary onError={close}>
          <Suspense fallback={null}>
            <UpdateLightbox images={safe} index={openAt} portalRoot={portalRoot} onClose={close} />
          </Suspense>
        </LightboxBoundary>
      )}
    </div>
  );
}
