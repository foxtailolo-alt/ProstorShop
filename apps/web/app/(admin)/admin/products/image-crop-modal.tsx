"use client";

import { useEffect, useRef, useState } from "react";

/** Crop region in percent (0-100) relative to displayed image */
type CropRegion = { x: number; y: number; w: number; h: number };

type ImageCropModalProps = {
  src: string;
  onSave: (crop: { x: number; y: number; w: number; h: number }) => void;
  onClose: () => void;
};

export function ImageCropModal({ src, onSave, onClose }: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRegion>({ x: 5, y: 5, w: 90, h: 90 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const startRef = useRef<{ mx: number; my: number; crop: CropRegion } | null>(null);

  function getRelXY(e: React.MouseEvent) {
    const el = containerRef.current;
    if (!el) return { rx: 0, ry: 0 };
    const rect = el.getBoundingClientRect();
    return {
      rx: ((e.clientX - rect.left) / rect.width) * 100,
      ry: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  function handlePointerDown(e: React.MouseEvent) {
    e.preventDefault();
    const { rx, ry } = getRelXY(e);

    // Check corner handles (5% hit area)
    const ht = 5;
    const corners: Record<string, [number, number]> = {
      nw: [crop.x, crop.y],
      ne: [crop.x + crop.w, crop.y],
      sw: [crop.x, crop.y + crop.h],
      se: [crop.x + crop.w, crop.y + crop.h],
    };
    for (const [key, [cx, cy]] of Object.entries(corners)) {
      if (Math.abs(rx - cx) < ht && Math.abs(ry - cy) < ht) {
        setResizing(key);
        startRef.current = { mx: rx, my: ry, crop: { ...crop } };
        return;
      }
    }

    // Inside crop → drag
    if (rx >= crop.x && rx <= crop.x + crop.w && ry >= crop.y && ry <= crop.y + crop.h) {
      setDragging(true);
      startRef.current = { mx: rx, my: ry, crop: { ...crop } };
    } else {
      // Click outside → new crop from click
      const nc: CropRegion = { x: rx, y: ry, w: 0, h: 0 };
      setCrop(nc);
      setResizing("se");
      startRef.current = { mx: rx, my: ry, crop: nc };
    }
  }

  function handlePointerMove(e: React.MouseEvent) {
    if (!startRef.current) return;
    const { rx, ry } = getRelXY(e);
    const s = startRef.current;
    const dx = rx - s.mx;
    const dy = ry - s.my;

    if (resizing) {
      const c = { ...s.crop };
      if (resizing.includes("e")) c.w = Math.max(5, s.crop.w + dx);
      if (resizing.includes("w")) { c.x = s.crop.x + dx; c.w = Math.max(5, s.crop.w - dx); }
      if (resizing.includes("s")) c.h = Math.max(5, s.crop.h + dy);
      if (resizing.includes("n")) { c.y = s.crop.y + dy; c.h = Math.max(5, s.crop.h - dy); }
      c.x = Math.max(0, Math.min(c.x, 95));
      c.y = Math.max(0, Math.min(c.y, 95));
      c.w = Math.min(c.w, 100 - c.x);
      c.h = Math.min(c.h, 100 - c.y);
      setCrop(c);
      return;
    }

    if (dragging) {
      let nx = s.crop.x + dx;
      let ny = s.crop.y + dy;
      nx = Math.max(0, Math.min(nx, 100 - s.crop.w));
      ny = Math.max(0, Math.min(ny, 100 - s.crop.h));
      setCrop({ ...s.crop, x: nx, y: ny });
    }
  }

  function handlePointerUp() {
    setDragging(false);
    setResizing(null);
    startRef.current = null;
  }

  function handleSave() {
    // Convert percent to pixels
    const scaleX = imgSize.w / 100;
    const scaleY = imgSize.h / 100;
    onSave({
      x: Math.round(crop.x * scaleX),
      y: Math.round(crop.y * scaleY),
      w: Math.round(crop.w * scaleX),
      h: Math.round(crop.h * scaleY),
    });
  }

  const dimStyle = (pos: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    background: "rgba(0,0,0,0.5)",
    pointerEvents: "none",
    ...pos,
  });

  const cropPx = {
    left: `${crop.x}%`,
    top: `${crop.y}%`,
    width: `${crop.w}%`,
    height: `${crop.h}%`,
  };

  return (
    <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" style={{ maxWidth: 660 }}>
        <div className="admin-modal-header">
          <h3 style={{ margin: 0 }}>Кадрирование</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {!loaded && <p>Загрузка...</p>}
          <div
            ref={containerRef}
            style={{
              position: "relative",
              display: loaded ? "block" : "none",
              cursor: resizing ? "nwse-resize" : dragging ? "grabbing" : "crosshair",
              userSelect: "none",
              maxWidth: "100%",
              lineHeight: 0,
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Crop preview"
              style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
              onLoad={(e) => {
                const el = e.currentTarget;
                setImgSize({ w: el.naturalWidth, h: el.naturalHeight });
                setLoaded(true);
              }}
              draggable={false}
            />
            {/* Dim regions outside crop */}
            <div style={dimStyle({ top: 0, left: 0, right: 0, height: cropPx.top })} />
            <div style={dimStyle({ top: `${crop.y + crop.h}%`, left: 0, right: 0, bottom: 0 })} />
            <div style={dimStyle({ top: cropPx.top, left: 0, width: cropPx.left, height: cropPx.height })} />
            <div style={dimStyle({ top: cropPx.top, left: `${crop.x + crop.w}%`, right: 0, height: cropPx.height })} />
            {/* Crop border */}
            <div
              style={{
                position: "absolute",
                ...cropPx,
                border: "2px solid #4f6ef7",
                pointerEvents: "none",
                boxSizing: "border-box",
              }}
            >
              {/* Grid lines (thirds) */}
              {[1, 2].map((i) => (
                <div key={`v${i}`} style={{ position: "absolute", left: `${(i * 100) / 3}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.3)" }} />
              ))}
              {[1, 2].map((i) => (
                <div key={`h${i}`} style={{ position: "absolute", top: `${(i * 100) / 3}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.3)" }} />
              ))}
            </div>
            {/* Corner handles */}
            {[
              { k: "nw", l: crop.x, t: crop.y },
              { k: "ne", l: crop.x + crop.w, t: crop.y },
              { k: "sw", l: crop.x, t: crop.y + crop.h },
              { k: "se", l: crop.x + crop.w, t: crop.y + crop.h },
            ].map(({ k, l, t }) => (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: `${l}%`,
                  top: `${t}%`,
                  width: 10,
                  height: 10,
                  marginLeft: -5,
                  marginTop: -5,
                  background: "#4f6ef7",
                  border: "2px solid #fff",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            ))}
          </div>
          {loaded && (
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              {Math.round((crop.w * imgSize.w) / 100)} × {Math.round((crop.h * imgSize.h) / 100)} px
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button button-secondary" onClick={onClose}>Отмена</button>
            <button className="button button-primary" onClick={handleSave} disabled={!loaded || crop.w < 5 || crop.h < 5}>
              Применить кроп
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
