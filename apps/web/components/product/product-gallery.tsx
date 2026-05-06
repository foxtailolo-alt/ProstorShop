"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartRef = useRef(0);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const goTo = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((prev) => (prev + direction + images.length) % images.length);
    },
    [images.length],
  );

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goTo(1);
      if (e.key === "ArrowLeft") goTo(-1);
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, closeLightbox, goTo]);

  useEffect(() => {
    if (!lightboxOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (images.length <= 1) return;
    const delta = touchStartRef.current - (e.changedTouches[0]?.clientX ?? 0);
    if (Math.abs(delta) > 40) {
      goTo(delta > 0 ? 1 : -1);
    }
  }

  if (images.length === 0) {
    return (
      <div className="product-media product-media-large">
        <div className="product-media-fallback" />
      </div>
    );
  }

  return (
    <>
      <div className="product-gallery">
        <div
          className="product-media product-media-large product-media-clickable"
          onClick={() => setLightboxOpen(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
        >
          <img src={images[activeIndex]} alt={`${productName} ${activeIndex + 1}`} loading="lazy" />
          <div className="product-media-zoom-hint">🔍</div>
        </div>
        {images.length > 1 ? (
          <div className="product-gallery-strip">
            {images.map((url, index) => (
              <button
                key={url}
                type="button"
                className={`product-gallery-thumb glass ${index === activeIndex ? "product-gallery-thumb-active" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                <img src={url} alt={`${productName} ${index + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {lightboxOpen ? (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div
            className="lightbox-shell"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="lightbox-topbar">
              <div className="lightbox-meta">
                <strong>{productName}</strong>
                <span>{activeIndex + 1} / {images.length}</span>
              </div>
              <button type="button" className="lightbox-close" onClick={closeLightbox} aria-label="Закрыть просмотр">
                ✕
              </button>
            </div>

            <div className="lightbox-stage">
              {images.length > 1 ? (
                <button
                  type="button"
                  className="lightbox-arrow lightbox-arrow-prev"
                  onClick={() => goTo(-1)}
                  aria-label="Предыдущее изображение"
                >
                  ‹
                </button>
              ) : null}

              <div className="lightbox-image-frame">
                <img
                  src={images[activeIndex]}
                  alt={`${productName} ${activeIndex + 1}`}
                  className="lightbox-image"
                />
              </div>

              {images.length > 1 ? (
                <button
                  type="button"
                  className="lightbox-arrow lightbox-arrow-next"
                  onClick={() => goTo(1)}
                  aria-label="Следующее изображение"
                >
                  ›
                </button>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="lightbox-thumb-rail" role="tablist" aria-label="Изображения товара">
                {images.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    className={`lightbox-thumb ${index === activeIndex ? "lightbox-thumb-active" : ""}`}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Открыть изображение ${index + 1}`}
                    aria-selected={index === activeIndex}
                  >
                    <img src={url} alt={`${productName} превью ${index + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
