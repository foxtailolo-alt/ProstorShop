"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomepageSectionItem } from "../../lib/data/catalog";

type Props = {
  title: string;
  items: HomepageSectionItem[];
};

export function CoverflowCarousel({ title, items }: Props) {
  const validItems = items.filter((i) => i.product);
  const [active, setActive] = useState(Math.floor(validItems.length / 2));
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(0);
  const dragOffset = useRef(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const count = validItems.length;
  if (count === 0) return null;

  const goTo = useCallback(
    (idx: number) => setActive(Math.max(0, Math.min(count - 1, idx))),
    [count],
  );

  // Autoplay
  useEffect(() => {
    if (hovered || dragging || count <= 1) return;
    autoplayRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % count);
    }, 4000);
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [hovered, dragging, count]);

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = e.clientX;
    dragOffset.current = 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    dragOffset.current = e.clientX - dragStart.current;
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = 60;
    if (dragOffset.current < -threshold) goTo(active + 1);
    else if (dragOffset.current > threshold) goTo(active - 1);
  };

  // Wheel
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 30) goTo(active + 1);
      else if (e.deltaX < -30) goTo(active - 1);
    }
  };

  return (
    <section className="store-section">
      <h2 className="store-section-title animate-fade-up">{title}</h2>
      <div
        ref={containerRef}
        className="coverflow"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="coverflow-track">
          {validItems.map((item, idx) => {
            const p = item.product!;
            const offset = idx - active;
            const absOff = Math.abs(offset);
            const isActive = offset === 0;

            const translateX = offset * 220;
            const translateZ = isActive ? 0 : -120 * Math.min(absOff, 3);
            const rotateY = offset === 0 ? 0 : offset < 0 ? 35 : -35;
            const scale = isActive ? 1 : Math.max(0.75, 1 - absOff * 0.08);
            const opacity = absOff > 3 ? 0 : isActive ? 1 : 0.7;
            const zIndex = 100 - absOff;

            return (
              <div
                key={item.id}
                className={`coverflow-item ${isActive ? "coverflow-item-active" : ""}`}
                style={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex,
                  pointerEvents: absOff > 1 ? "none" : "auto",
                }}
                onClick={() => !isActive && goTo(idx)}
              >
                <div className="coverflow-card glass">
                  <div className="coverflow-card-img">
                    {p.imageUrls[0] || p.imageUrl ? (
                      <img
                        src={p.imageUrls[0] ?? p.imageUrl ?? ""}
                        alt={p.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="product-media-fallback" />
                    )}
                  </div>
                  <div className="coverflow-card-body">
                    <span className="product-card-brand">{p.brand}</span>
                    <Link
                      href={`/catalog/${p.categorySlug}/${p.slug}`}
                      className="product-card-name"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.name}
                    </Link>
                    <span className="product-card-price">
                      {p.price.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation dots */}
        {count > 1 && (
          <div className="coverflow-dots">
            {validItems.map((_, idx) => (
              <button
                key={idx}
                className={`coverflow-dot ${idx === active ? "coverflow-dot-active" : ""}`}
                onClick={() => goTo(idx)}
                aria-label={`Слайд ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
