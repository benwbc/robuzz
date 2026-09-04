import { useCallback, useEffect } from 'react';
import Icon from './Icon';
import { mediaUrl } from '../api';

// Fullscreen viewer for a post's images — click an image in the feed or
// post detail to open it large, then arrow-key/click/swipe through the
// rest of that post's photos without leaving the page.
export default function ImageLightbox({ images, index, onNavigate, onClose }) {
  const count = images.length;

  const goPrev = useCallback(
    (e) => {
      e?.stopPropagation();
      onNavigate((index - 1 + count) % count);
    },
    [index, count, onNavigate]
  );

  const goNext = useCallback(
    (e) => {
      e?.stopPropagation();
      onNavigate((index + 1) % count);
    },
    [index, count, onNavigate]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) goPrev();
      else if (e.key === 'ArrowRight' && count > 1) goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext, count]);

  // Prevent the page behind the lightbox from scrolling while it's open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="lightbox-overlay"
      onClick={(e) => {
        // Stop here so a backdrop click doesn't also bubble up to the
        // post card underneath and navigate to the post itself.
        e.stopPropagation();
        onClose();
      }}
    >
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <Icon name="close" size={22} />
      </button>

      {count > 1 && (
        <button className="lightbox-nav lightbox-prev" onClick={goPrev} aria-label="Previous image">
          <Icon name="chevronLeft" size={28} />
        </button>
      )}

      <img
        className="lightbox-image"
        src={mediaUrl(images[index])}
        alt={`Image ${index + 1} of ${count}`}
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <button className="lightbox-nav lightbox-next" onClick={goNext} aria-label="Next image">
          <Icon name="chevronRight" size={28} />
        </button>
      )}

      {count > 1 && (
        <div className="lightbox-counter" onClick={(e) => e.stopPropagation()}>
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}
