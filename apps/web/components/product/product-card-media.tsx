"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProductCardMediaProps = {
  images: string[];
  productName: string;
  badge?: string | null;
};

export function ProductCardMedia({ images, productName, badge }: ProductCardMediaProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCycle = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCycle = useCallback(() => {
    if (images.length <= 1) return;
    clearCycle();
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, 3000);
  }, [images.length, clearCycle]);

  useEffect(() => {
    return clearCycle;
  }, [clearCycle]);

  function handleMouseEnter() {
    startCycle();
  }

  function handleMouseLeave() {
    clearCycle();
    setActiveIndex(0);
  }

  const currentImage = images[activeIndex] ?? images[0];

  return (
    <div
      className="product-card-media"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
