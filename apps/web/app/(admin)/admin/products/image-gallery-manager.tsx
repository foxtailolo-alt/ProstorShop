"use client";

import { useRef, useState, useTransition } from "react";
import { reorderProductImagesAction, deleteProductImageAction } from "./actions";

type ImageGalleryManagerProps = {
  sku: string;
  imageUrls: string[];
  productName: string;
};

export function ImageGalleryManager({ sku, imageUrls, productName }: ImageGalleryManagerProps) {
  const [images, setImages] = useState(imageUrls);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (images.length === 0) {
    return <p className="muted">Нет изображений. Загрузите фото через форму выше.</p>;
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setOverIndex(index);
  }

  function handleDragLeave() {
    setOverIndex(null);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    const next = [...images];
    const moved = next.splice(dragIndex, 1)[0]!;
    next.splice(index, 0, moved);
    setImages(next);
    setDragIndex(null);
    setOverIndex(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrls", JSON.stringify(next));
      await reorderProductImagesAction(fd);
    });
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleMoveLeft(index: number) {
    if (index === 0) return;
    const next = [...images];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    setImages(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrls", JSON.stringify(next));
      await reorderProductImagesAction(fd);
    });
  }

  function handleMoveRight(index: number) {
    if (index === images.length - 1) return;
    const next = [...images];
    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
    setImages(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrls", JSON.stringify(next));
      await reorderProductImagesAction(fd);
    });
  }

  return (
    <div className={`admin-gallery-manager ${isPending ? "admin-gallery-pending" : ""}`}>
      <div className="admin-gallery-grid">
        {images.map((url, index) => (
          <div
            key={url}
            className={`admin-gallery-item ${dragIndex === index ? "admin-gallery-dragging" : ""} ${overIndex === index ? "admin-gallery-over" : ""}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
          >
            <img src={url} alt={`${productName} ${index + 1}`} loading="lazy" />
            <div className="admin-gallery-badge">
              {index === 0 ? "Главное" : index + 1}
            </div>
            <div className="admin-gallery-controls">
              <button
                type="button"
                className="admin-gallery-btn"
                title="Переместить влево"
                disabled={index === 0 || isPending}
                onClick={() => handleMoveLeft(index)}
              >
                ←
              </button>
              <button
                type="button"
                className="admin-gallery-btn"
                title="Переместить вправо"
                disabled={index === images.length - 1 || isPending}
                onClick={() => handleMoveRight(index)}
              >
                →
              </button>
              <form action={deleteProductImageAction} ref={formRef}>
                <input type="hidden" name="sku" value={sku} />
                <input type="hidden" name="imageUrl" value={url} />
                <button
                  type="submit"
                  className="admin-gallery-btn admin-gallery-btn-delete"
                  title="Удалить фото"
                  disabled={isPending}
                >
                  ✕
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">Перетаскивайте или используйте стрелки для смены порядка. Первое фото — главное.</p>
    </div>
  );
}
