"use client";

import { useCallback, useRef, useState } from "react";

type ProductCardMediaProps = {
  images: string[];
  productName: string;
  badge?: string | null;
};

export function ProductCardMedia({ images, productName, badge }: ProductCardMediaProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef(0);

  function handleMouseMove(e: React.MouseEvent) {
    if (images.length <= 1) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const idx = Math.min(Math.floor(pct * images.length), images.length - 1);
    if (idx !== activeIndex) setActiveIndex(idx);
  }

  function handleMouseLeave() {
    setActiveIndex(0);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (images.length <= 1) return;
    const delta = touchStartRef.current - (e.changedTouches[0]?.clientX ?? 0);
    if (Math.abs(delta) > 30) {
      e.preventDefault();
      setActiveIndex((prev) =>
        delta > 0
          ? (prev + 1) % images.length
          : (prev - 1 + images.length) % images.length,
      );
    }
  }

  const currentImage = images[activeIndex] ?? images[0];

  return (
    <div
      ref={containerRef}
      className="product-card-media"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {currentImage ? (
        <img src={currentImage} alt={productName} loading="lazy" />
      ) : (
        <div className="product-media-fallback" />
      )}
      {badge ? <span className="product-card-badge">{badge}</span> : null}
      {images.length > 1 ? (
        <div className="product-card-dots">
          {images.map((_, i) => (
            <span
              key={i}
              className={`product-card-dot ${i === activeIndex ? "product-card-dot-active" : ""}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
