"use client";

import { useEffect, useState, useTransition } from "react";
import { reorderProductImagesAction, deleteProductImageAction, cropProductImageAction, removeImageBackgroundAction } from "./actions";
import { ImageCropModal } from "./image-crop-modal";

type ImageGalleryManagerProps = {
  sku: string;
  imageUrls: string[];
  productName: string;
  onChange?: (imageUrls: string[]) => void;
  onDeleteImage?: (index: number) => void;
  persistChanges?: boolean;
};

export function ImageGalleryManager({
  sku,
  imageUrls,
  productName,
  onChange,
  onDeleteImage,
  persistChanges = true,
}: ImageGalleryManagerProps) {
  const [images, setImages] = useState(imageUrls);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [removingBg, setRemovingBg] = useState<number | null>(null);

  useEffect(() => {
    setImages(imageUrls);
  }, [imageUrls]);

  function applyImages(next: string[]) {
    setImages(next);
    onChange?.(next);
  }

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
    applyImages(next);
    setDragIndex(null);
    setOverIndex(null);

    if (!persistChanges) {
      return;
    }

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
    applyImages(next);

    if (!persistChanges) {
      return;
    }

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
    applyImages(next);

    if (!persistChanges) {
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrls", JSON.stringify(next));
      await reorderProductImagesAction(fd);
    });
  }

  function handleDelete(index: number) {
    const imageUrl = images[index];

    if (!imageUrl) {
      return;
    }

    const next = images.filter((url) => url !== imageUrl);
    applyImages(next);

    if (onDeleteImage) {
      onDeleteImage(index);
      return;
    }

    if (!persistChanges) {
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrl", imageUrl);

      try {
        await deleteProductImageAction(fd);
      } catch {
        applyImages(images);
      }
    });
  }

  function handleCropSave(crop: { x: number; y: number; w: number; h: number }, index: number) {
    const oldUrl = images[index];
    if (!oldUrl) return;
    setCropIndex(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrl", oldUrl);
      fd.set("cx", String(crop.x));
      fd.set("cy", String(crop.y));
      fd.set("cw", String(crop.w));
      fd.set("ch", String(crop.h));
      try {
        const result = await cropProductImageAction(fd);
        if (result.newUrl) {
          const next = images.map((url) => (url === oldUrl ? result.newUrl : url));
          applyImages(next);
        }
      } catch {
        // keep current
      }
    });
  }

  function handleRemoveBg(index: number) {
    const url = images[index];
    if (!url) return;
    setRemovingBg(index);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("imageUrl", url);
      try {
        const result = await removeImageBackgroundAction(fd);
        if (result.newUrl) {
          const next = images.map((u) => (u === url ? result.newUrl : u));
          applyImages(next);
        }
      } catch {
        // keep current
      } finally {
        setRemovingBg(null);
      }
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
            {removingBg === index && (
              <div className="admin-gallery-loading">Удаление фона...</div>
            )}
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
              <button
                type="button"
                className="admin-gallery-btn"
                title="Кадрировать"
                disabled={isPending}
                onClick={() => setCropIndex(index)}
              >
                ✂
              </button>
              <button
                type="button"
                className="admin-gallery-btn"
                title="Удалить фон"
                disabled={isPending}
                onClick={() => handleRemoveBg(index)}
              >
                🪄
              </button>
              <button
                type="button"
                className="admin-gallery-btn admin-gallery-btn-delete"
                title="Удалить фото"
                disabled={isPending}
                onClick={() => handleDelete(index)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="muted">Перетаскивайте или используйте стрелки для смены порядка. Первое фото — главное.</p>

      {cropIndex !== null && images[cropIndex] && (
        <ImageCropModal
          src={images[cropIndex]}
          onSave={(crop) => handleCropSave(crop, cropIndex)}
          onClose={() => setCropIndex(null)}
        />
      )}
    </div>
  );
}
