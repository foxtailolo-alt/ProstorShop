"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Banner = {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string;
};

type BannerCarouselProps = {
  banners: Banner[];
};

export function BannerCarousel({ banners }: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef(0);

  const count = banners.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % count) + count) % count);
    },
    [count],
  );

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => goTo(current + 1), 5000);
  }, [current, goTo]);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setCurrent((prev) => (prev + 1) % count), 5000);
    timerRef.current = timer;
    return () => clearInterval(timer);
  }, [count]);

  const handlePrev = () => {
    goTo(current - 1);
    resetTimer();
  };

  const handleNext = () => {
    goTo(current + 1);
    resetTimer();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0]?.clientX ?? 0;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartRef.current - (e.changedTouches[0]?.clientX ?? 0);
    if (Math.abs(delta) > 40) {
      delta > 0 ? handleNext() : handlePrev();
    }
  };

  if (count === 0) return null;

  const banner = banners[current]!;

  return (
    <div
      className="banner-carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <a href={banner.linkUrl} className="banner-carousel-slide">
        <img
          src={banner.imageUrl}
          alt={banner.title ?? "Баннер"}
          className="banner-carousel-image"
          draggable={false}
        />
      </a>

      {count > 1 && (
        <>
          <button className="banner-carousel-arrow banner-carousel-prev" onClick={handlePrev} aria-label="Предыдущий">
            ‹
          </button>
          <button className="banner-carousel-arrow banner-carousel-next" onClick={handleNext} aria-label="Следующий">
            ›
          </button>
          <div className="banner-carousel-dots">
            {banners.map((_, i) => (
              <button
                key={i}
                className={`banner-carousel-dot${i === current ? " banner-carousel-dot-active" : ""}`}
                onClick={() => { goTo(i); resetTimer(); }}
                aria-label={`Баннер ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
