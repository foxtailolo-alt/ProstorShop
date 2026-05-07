"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const goTo = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((prev) => (prev + direction + images.length) % images.length);
    },
    [images.length],
  );

  // Gallery thumbnail swipe
  const galleryTouchRef = useRef(0);
  function handleGalleryTouchStart(e: React.TouchEvent) {
    galleryTouchRef.current = e.touches[0]?.clientX ?? 0;
  }
  function handleGalleryTouchEnd(e: React.TouchEvent) {
    if (images.length <= 1) return;
    const delta = galleryTouchRef.current - (e.changedTouches[0]?.clientX ?? 0);
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
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={handleGalleryTouchEnd}
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

      {lightboxOpen
        ? createPortal(
            <Lightbox
              images={images}
              productName={productName}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              goTo={goTo}
              onClose={closeLightbox}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/* ─── Lightbox ─── */

type LightboxProps = {
  images: string[];
  productName: string;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  goTo: (d: 1 | -1) => void;
  onClose: () => void;
};

function Lightbox({ images, productName, activeIndex, setActiveIndex, goTo, onClose }: LightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [transitioning, setTransitioning] = useState(false);

  // Touch tracking
  const touchRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startDist: 0,
    startScale: 1,
    isPinching: false,
    isSwiping: false,
    swipeDelta: 0,
    startTranslate: { x: 0, y: 0 },
  });

  const [swipeOffset, setSwipeOffset] = useState(0);

  // Reset zoom on image change
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 280);
    return () => clearTimeout(t);
  }, [activeIndex]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(1);
      if (e.key === "ArrowLeft") goTo(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, goTo]);

  // Double-tap to zoom
  const lastTapRef = useRef(0);
  function handleDoubleTap(clientX: number, clientY: number) {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const originX = clientX - rect.left - rect.width / 2;
      const originY = clientY - rect.top - rect.height / 2;
      setScale(2.5);
      setTranslate({ x: -originX * 0.6, y: -originY * 0.6 });
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = touchRef.current;

    if (e.touches.length === 2) {
      // Pinch start
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      t.startDist = Math.hypot(dx, dy);
      t.startScale = scale;
      t.isPinching = true;
      t.isSwiping = false;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      t.startX = touch.clientX;
      t.startY = touch.clientY;
      t.lastX = touch.clientX;
      t.lastY = touch.clientY;
      t.isSwiping = false;
      t.isPinching = false;
      t.swipeDelta = 0;
      t.startTranslate = { ...translate };

      // Double-tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap(touch.clientX, touch.clientY);
        lastTapRef.current = 0;
        e.preventDefault();
      } else {
        lastTapRef.current = now;
      }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    const t = touchRef.current;

    if (t.isPinching && e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(5, Math.max(1, t.startScale * (dist / t.startDist)));
      setScale(newScale);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      const dx = touch.clientX - t.startX;
      const dy = touch.clientY - t.startY;

      if (scale > 1) {
        // Pan when zoomed
        e.preventDefault();
        const moveDx = touch.clientX - t.lastX;
        const moveDy = touch.clientY - t.lastY;
        setTranslate((prev) => ({ x: prev.x + moveDx, y: prev.y + moveDy }));
        t.lastX = touch.clientX;
        t.lastY = touch.clientY;
      } else {
        // Swipe to navigate or dismiss
        if (!t.isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          t.isSwiping = true;
        }
        if (t.isSwiping) {
          e.preventDefault();
          t.swipeDelta = dx;
          setSwipeOffset(dx);
        }
      }
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const t = touchRef.current;

    if (t.isPinching) {
      t.isPinching = false;
      if (scale <= 1) {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
      return;
    }

    if (t.isSwiping && images.length > 1) {
      const threshold = window.innerWidth * 0.2;
      if (Math.abs(t.swipeDelta) > threshold) {
        goTo(t.swipeDelta < 0 ? 1 : -1);
      }
      setSwipeOffset(0);
      t.isSwiping = false;
      t.swipeDelta = 0;
      return;
    }

    // Snap back zoom if slightly under 1
    if (scale < 1.05 && scale !== 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }

    setSwipeOffset(0);
  }

  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="lb-container" ref={containerRef} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lb-header">
          <div className="lb-counter">
            {activeIndex + 1}<span className="lb-counter-sep">/</span>{images.length}
          </div>
          <button type="button" className="lb-btn lb-close" onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Image stage */}
        <div
          className="lb-stage"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Arrows - desktop only */}
          {images.length > 1 ? (
            <button type="button" className="lb-arrow lb-arrow-prev" onClick={() => goTo(-1)} aria-label="Назад">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : null}

          <div
            className={`lb-image-wrap${transitioning ? " lb-transitioning" : ""}`}
            style={{
              transform: `translate(${translate.x + swipeOffset}px, ${translate.y}px) scale(${scale})`,
              ...(swipeOffset !== 0 ? { transition: "none" } : {}),
            }}
          >
            <img
              ref={imageRef}
              src={images[activeIndex]}
              alt={`${productName} ${activeIndex + 1}`}
              className="lb-image"
              draggable={false}
              onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
            />
          </div>

          {images.length > 1 ? (
            <button type="button" className="lb-arrow lb-arrow-next" onClick={() => goTo(1)} aria-label="Вперёд">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : null}
        </div>

        {/* Thumbnails */}
        {images.length > 1 ? (
          <div className="lb-thumbs">
            {images.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                className={`lb-thumb${index === activeIndex ? " lb-thumb-active" : ""}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Изображение ${index + 1}`}
              >
                <img src={url} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
