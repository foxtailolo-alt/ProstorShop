"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SquareImageEditorModalProps = {
  src: string;
  title?: string;
  confirmLabel?: string;
  onSave: (file: File, previewUrl: string) => void;
  onClose: () => void;
};

const outputSize = 1400;
const minZoom = 0.35;
const maxZoom = 3;
const centerSnapThreshold = 28;

type Size = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SquareImageEditorModal({
  src,
  title = "Изображение",
  confirmLabel = "Сохранить",
  onSave,
  onClose,
}: SquareImageEditorModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStateRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [snapAxis, setSnapAxis] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  const baseSize = useMemo(() => {
    if (!imageSize) {
      return null;
    }

    const scale = Math.min(outputSize / imageSize.width, outputSize / imageSize.height);
    return {
      width: imageSize.width * scale,
      height: imageSize.height * scale,
    };
  }, [imageSize]);

  const renderedSize = useMemo(() => {
    if (!baseSize) {
      return null;
    }

    return {
      width: baseSize.width * zoom,
      height: baseSize.height * zoom,
    };
  }, [baseSize, zoom]);

  const zoomPercent = Math.round(zoom * 100);

  useEffect(() => {
    if (!baseSize) {
      return;
    }

    setZoom(1);
    setPosition({
      left: (outputSize - baseSize.width) / 2,
      top: (outputSize - baseSize.height) / 2,
    });
  }, [baseSize, src]);

  function clampPosition(next: { left: number; top: number }, size: Size | null) {
    if (!size) {
      return next;
    }

    const minLeft = Math.min(0, outputSize - size.width);
    const maxLeft = Math.max(0, outputSize - size.width);
    const minTop = Math.min(0, outputSize - size.height);
    const maxTop = Math.max(0, outputSize - size.height);

    return {
      left: clamp(next.left, minLeft, maxLeft),
      top: clamp(next.top, minTop, maxTop),
    };
  }

  function applyCenterSnap(next: { left: number; top: number }, size: Size | null) {
    if (!size) {
      return { position: next, snap: { x: false, y: false } };
    }

    const targetLeft = (outputSize - size.width) / 2;
    const targetTop = (outputSize - size.height) / 2;
    const snapX = Math.abs(next.left - targetLeft) <= centerSnapThreshold;
    const snapY = Math.abs(next.top - targetTop) <= centerSnapThreshold;

    return {
      position: {
        left: snapX ? targetLeft : next.left,
        top: snapY ? targetTop : next.top,
      },
      snap: { x: snapX, y: snapY },
    };
  }

  function handleZoomChange(nextZoom: number) {
    if (!baseSize || !renderedSize) {
      return;
    }

    const nextWidth = baseSize.width * nextZoom;
    const nextHeight = baseSize.height * nextZoom;
    const centerX = position.left + renderedSize.width / 2;
    const centerY = position.top + renderedSize.height / 2;

    const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
    const snapped = applyCenterSnap(clampPosition({
      left: centerX - nextWidth / 2,
      top: centerY - nextHeight / 2,
    }, { width: nextWidth, height: nextHeight }), { width: nextWidth, height: nextHeight });

    setZoom(clampedZoom);
    setPosition(snapped.position);
    setSnapAxis(snapped.snap);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: position.left,
      top: position.top,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current || !viewportRef.current || !renderedSize) {
      return;
    }

    const viewportRect = viewportRef.current.getBoundingClientRect();
    const ratio = outputSize / Math.max(viewportRect.width, 1);
    const dx = (event.clientX - dragStateRef.current.x) * ratio;
    const dy = (event.clientY - dragStateRef.current.y) * ratio;

    const snapped = applyCenterSnap(clampPosition({
      left: dragStateRef.current.left + dx,
      top: dragStateRef.current.top + dy,
    }, renderedSize), renderedSize);

    setPosition(snapped.position);
    setSnapAxis(snapped.snap);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = null;
    setSnapAxis({ x: false, y: false });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleSave() {
    if (!imageRef.current || !renderedSize) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(imageRef.current, position.left, position.top, renderedSize.width, renderedSize.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error("Failed to export image."));
      }, "image/webp", 0.92);
    });

    const file = new File([blob], "square-image.webp", { type: "image/webp" });
    const previewUrl = URL.createObjectURL(file);
    onSave(file, previewUrl);
  }

  return (
    <div className="admin-modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-modal" style={{ maxWidth: 640 }}>
        <div className="admin-modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="square-editor-layout">
          <div
            ref={viewportRef}
            className="square-editor-viewport"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imageRef}
              src={src}
              alt="Square editor preview"
              draggable={false}
              className="square-editor-image"
              style={{
                width: renderedSize ? `${(renderedSize.width / outputSize) * 100}%` : undefined,
                height: renderedSize ? `${(renderedSize.height / outputSize) * 100}%` : undefined,
                left: `${(position.left / outputSize) * 100}%`,
                top: `${(position.top / outputSize) * 100}%`,
              }}
              onLoad={(event) => {
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />
            <div className={`square-editor-guide square-editor-guide-x ${snapAxis.x ? "square-editor-guide-active" : ""}`} />
            <div className={`square-editor-guide square-editor-guide-y ${snapAxis.y ? "square-editor-guide-active" : ""}`} />
            <div className="square-editor-frame" />
          </div>

          <div className="square-editor-controls">
            <label className="square-editor-slider-label">
              <span className="square-editor-slider-header">
                <span>Масштаб</span>
                <span>{zoomPercent}%</span>
              </span>
              <input
                type="range"
                min={String(minZoom)}
                max={String(maxZoom)}
                step="0.01"
                value={zoom}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
              />
            </label>
            <p className="muted" style={{ margin: 0 }}>
              Фото сохраняется квадратным. По умолчанию оно целиком вписывается в квадрат, а здесь можно приблизить и сместить его внутри рамки.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="button button-secondary" type="button" onClick={onClose}>Отмена</button>
            <button className="button button-primary" type="button" onClick={handleSave} disabled={!renderedSize}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}