"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomepageSectionItem } from "../../lib/data/catalog";

type Props = {
  title: string;
  items: HomepageSectionItem[];
};

export function CoverflowCarousel({ title, items }: Props) {
  const validItems = items
    .filter((i) => i.product)
    .map((item, position) => ({ ...item, position }));
  const [active, setActive] = useState(
    validItems.length + Math.floor(validItems.length / 2),
  );
  const [dragging, setDragging] = useState(false);
  const [transitionsEnabled, setTransitionsEnabled] = useState(true);
  const dragStart = useRef(0);
  const dragOffset = useRef(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const count = validItems.length;
  if (count === 0) return null;

  function wrapIndex(idx: number) {
    return ((idx % count) + count) % count;
  }

  const normalizedActive = wrapIndex(active);
  const repeatedItems = Array.from({ length: count * 3 }, (_, virtualIndex) => ({
    item: validItems[virtualIndex % count]!,
    virtualIndex,
  }));

  const findNearestLoopIndex = useCallback(
    (targetIndex: number) => {
      const normalizedTarget = wrapIndex(targetIndex);
      const candidates: [number, number, number] = [
        normalizedTarget,
        normalizedTarget + count,
        normalizedTarget + count * 2,
      ];

      return candidates.reduce<number>((closest, candidate) => {
        if (Math.abs(candidate - active) < Math.abs(closest - active)) {
          return candidate;
        }

        return closest;
      }, candidates[0]);
    },
    [active, count],
  );

  const goTo = useCallback(
    (idx: number) => {
      setTransitionsEnabled(true);
      setActive(findNearestLoopIndex(idx));
    },
    [findNearestLoopIndex],
  );

  const stepBy = useCallback((delta: number) => {
    setTransitionsEnabled(true);
    setActive((prev) => prev + delta);
  }, []);

  useEffect(() => {
    setTransitionsEnabled(true);
    setActive(count + Math.floor(count / 2));
  }, [count]);

  useEffect(() => {
    if (count <= 1) {
      return;
    }

    if (active >= count && active < count * 2) {
      return;
    }

    const nextActive = wrapIndex(active) + count;
    let restoreFrame = 0;

    const resetFrame = requestAnimationFrame(() => {
      setTransitionsEnabled(false);
      setActive(nextActive);

      restoreFrame = requestAnimationFrame(() => {
        setTransitionsEnabled(true);
      });
    });

    return () => {
      cancelAnimationFrame(resetFrame);
      cancelAnimationFrame(restoreFrame);
    };
  }, [active, count]);

  // Autoplay
  useEffect(() => {
    if (hovered || dragging || count <= 1) return;
    autoplayRef.current = setInterval(() => {
      stepBy(1);
    }, 4000);
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [hovered, dragging, count, stepBy]);

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
    if (dragOffset.current < -threshold) stepBy(1);
    else if (dragOffset.current > threshold) stepBy(-1);
  };

  // Wheel
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 30) stepBy(1);
      else if (e.deltaX < -30) stepBy(-1);
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
          {repeatedItems.map(({ item, virtualIndex }) => {
            const p = item.product!;
            const offset = virtualIndex - active;
            const absOff = Math.abs(offset);
            const isActive = offset === 0;

            const translateX = offset * 220;
            const translateZ = isActive ? 0 : -120 * Math.min(absOff, 3);
            const rotateY = offset === 0 ? 0 : offset < 0 ? 35 : -35;
            const scale = isActive ? 1 : Math.max(0.75, 1 - absOff * 0.08);
            const opacity = absOff > 3 ? 0 : 1;
            const zIndex = 100 - absOff;

            return (
              <div
                key={`${item.id}-${virtualIndex}`}
                className={`coverflow-item ${isActive ? "coverflow-item-active" : ""} ${transitionsEnabled ? "" : "coverflow-item-no-transition"}`}
                style={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex,
                  pointerEvents: absOff > 1 ? "none" : "auto",
                }}
                onClick={() => !isActive && goTo(item.position)}
              >
                <div className="coverflow-card">
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
                className={`coverflow-dot ${idx === normalizedActive ? "coverflow-dot-active" : ""}`}
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
