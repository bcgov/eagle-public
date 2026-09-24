import Lightbox from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
// Every selector in these sheets is `.yarl__` prefixed, so nothing reaches the rest of the site.
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import type { UpdateImage } from 'app/api/updates';
import './update-lightbox.css';

interface Props {
  images: UpdateImage[];
  index: number;
  /** The modal `<dialog>` the gallery sits in, if any; unset mounts on `document.body`. */
  portalRoot: HTMLElement | null;
  onClose: () => void;
}

/** The full-screen photo viewer, loaded only when a gallery photo is opened. */
export default function UpdateLightbox({ images, index, portalRoot, onClose }: Props) {
  const total = images.length;
  return (
    <Lightbox
      open
      index={index}
      close={onClose}
      className="update-lightbox"
      // The count rides in the caption's bottom line: the Counter plugin sits top left, where it
      // collides with the title.
      plugins={total >= 3 ? [Captions, Thumbnails] : [Captions]}
      slides={images.map((image, at) => ({
        src: image.src,
        alt: image.alt,
        title: image.caption ?? undefined,
        description:
          [
            total > 1 ? `${at + 1} of ${total}` : null,
            image.credit ? `Photo: ${image.credit}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
      }))}
      carousel={{ finite: total < 3 }}
      portal={{
        root: portalRoot,
        container: {
          // Escape closes the viewer only; left alone, the host <dialog> would take it as its own.
          onKeyDownCapture: (event) => {
            if (event.key === 'Escape') event.preventDefault();
          },
        },
      }}
    />
  );
}
