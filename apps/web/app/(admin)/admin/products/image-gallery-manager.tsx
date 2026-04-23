"use client";

import { useEffect, useState, useTransition } from "react";
import { reorderProductImagesAction, deleteProductImageAction, replaceProductImageAction, removeImageBackgroundAction } from "./actions";
import { SquareImageEditorModal } from "../../../../components/admin/square-image-editor-modal";

type ImageGalleryManagerProps = {
  sku: string;
  imageUrls: string[];
  productName: string;
  onChange?: (imageUrls: string[]) => void;
  onDeleteImage?: (index: number) => void;
  onReplaceImage?: (index: number, file: File, previewUrl: string) => void;
  persistChanges?: boolean;
};

export function ImageGalleryManager({
  sku,
  imageUrls,
  productName,
  onChange,
  onDeleteImage,
  onReplaceImage,
  persistChanges = true,
}: ImageGalleryManagerProps) {
  const [images, setImages] = useState(imageUrls);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [removingBg, setRemovingBg] = useState<number | null>(null);

  useEffect(() => {
    setImages(imageUrls);
  }, [imageUrls]);

  function applyImages(next: string[]) {
    setImages(next);
    onChange?.(next);
  }

  async function loadImageElement(src: string) {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image."));
      image.src = src;
    });
  }

  async function canvasToFile(canvas: HTMLCanvasElement, fileName: string, type: string) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error("Failed to export image."));
      }, type);
    });

    return new File([blob], fileName, { type });
  }

  async function applyLocalBackgroundRemoval(index: number) {
    const sourceUrl = images[index];

    if (!sourceUrl || !onReplaceImage) {
      return;
    }

    const image = await loadImageElement(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available.");
    }

    context.drawImage(image, 0, 0);

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    const totalPixels = canvas.width * canvas.height;
    const samplePositions = [0, canvas.width - 1, (canvas.height - 1) * canvas.width, totalPixels - 1];

    let bgR = 0;
    let bgG = 0;
    let bgB = 0;

    for (const position of samplePositions) {
      const pixelIndex = position * 4;
      bgR += pixels[pixelIndex] ?? 0;
      bgG += pixels[pixelIndex + 1] ?? 0;
      bgB += pixels[pixelIndex + 2] ?? 0;
    }

    bgR = Math.round(bgR / samplePositions.length);
    bgG = Math.round(bgG / samplePositions.length);
    bgB = Math.round(bgB / samplePositions.length);

    const tolerance = 42;
    for (let index = 0; index < totalPixels; index += 1) {
      const pixelIndex = index * 4;
      const red = pixels[pixelIndex] ?? 0;
      const green = pixels[pixelIndex + 1] ?? 0;
      const blue = pixels[pixelIndex + 2] ?? 0;
      const distance = Math.sqrt((red - bgR) ** 2 + (green - bgG) ** 2 + (blue - bgB) ** 2);

      if (distance < tolerance) {
        pixels[pixelIndex + 3] = 0;
      } else if (distance < tolerance * 1.5) {
        pixels[pixelIndex + 3] = Math.round(((distance - tolerance) / (tolerance * 0.5)) * 255);
      }
    }

    context.putImageData(frame, 0, 0);

    const file = await canvasToFile(canvas, "background-removed.png", "image/png");
    const previewUrl = URL.createObjectURL(file);
    const next = images.map((url, currentIndex) => (currentIndex === index ? previewUrl : url));

    applyImages(next);
    onReplaceImage(index, file, previewUrl);
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

  function handleSquareSave(file: File, previewUrl: string, index: number) {
    const oldUrl = images[index];
    if (!oldUrl) return;
    setEditIndex(null);

    if (!persistChanges) {
      const next = images.map((url, currentIndex) => (currentIndex === index ? previewUrl : url));
      applyImages(next);
      onReplaceImage?.(index, file, previewUrl);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("oldUrl", oldUrl);
      fd.set("file", file);
      try {
        const result = await replaceProductImageAction(fd);
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

    if (!persistChanges) {
      startTransition(async () => {
        try {
          await applyLocalBackgroundRemoval(index);
        } catch {
          // keep current
        } finally {
          setRemovingBg(null);
        }
      });
      return;
    }

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
                title="Подогнать в квадрат"
                disabled={isPending}
                onClick={() => setEditIndex(index)}
              >
                □
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

      {editIndex !== null && images[editIndex] && (
        <SquareImageEditorModal
          src={images[editIndex]}
          title="Фото в квадрате"
          confirmLabel="Применить"
          onSave={(file, previewUrl) => handleSquareSave(file, previewUrl, editIndex)}
          onClose={() => setEditIndex(null)}
        />
      )}
    </div>
  );
}
