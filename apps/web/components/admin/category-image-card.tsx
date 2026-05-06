"use client";

import { useEffect, useRef, useState } from "react";
import { SquareImageEditorModal } from "./square-image-editor-modal";

type CategoryImageCardProps = {
  categoryId: string;
  categorySlug?: string;
  categoryName?: string;
  label: string;
  imageUrl: string | null;
  action: (formData: FormData) => void | Promise<void>;
};

export function CategoryImageCard({ categoryId, categorySlug, categoryName, label, imageUrl, action }: CategoryImageCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setPreviewUrl(imageUrl);
    setSelectedFile(null);
    setEditorSrc(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== imageUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [imageUrl, previewUrl]);

  function syncInputFile(file: File) {
    if (!inputRef.current) {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }

  function replacePreview(nextFile: File, nextPreviewUrl: string) {
    setPreviewUrl((current) => {
      if (current && current !== imageUrl && current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });
    setSelectedFile(nextFile);
    syncInputFile(nextFile);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setEditorSrc(URL.createObjectURL(file));
  }

  return (
    <div className="card glass-strong admin-category-image-card">
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {previewUrl ? (
        <div className="admin-category-image-preview">
          <img src={previewUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ) : (
        <div className="admin-category-image-preview admin-category-image-preview-empty">
          Нет изображения
        </div>
      )}
      <form action={action} style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="categorySlug" value={categorySlug ?? ""} />
        <input type="hidden" name="categoryName" value={categoryName ?? ""} />
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          style={{ fontSize: 11, minWidth: 0 }}
          onChange={handleFileChange}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="button button-primary button-sm" type="submit" disabled={!selectedFile}>Сохранить</button>
          {selectedFile && previewUrl && (
            <button className="button button-secondary button-sm" type="button" onClick={() => setEditorSrc(previewUrl)}>
              Масштаб
            </button>
          )}
        </div>
      </form>

      {editorSrc && (
        <SquareImageEditorModal
          src={editorSrc}
          title="Фото категории"
          confirmLabel="Использовать"
          onSave={(file, nextPreviewUrl) => {
            replacePreview(file, nextPreviewUrl);
            if (editorSrc.startsWith("blob:") && editorSrc !== nextPreviewUrl) {
              URL.revokeObjectURL(editorSrc);
            }
            setEditorSrc(null);
          }}
          onClose={() => {
            if (editorSrc.startsWith("blob:") && editorSrc !== previewUrl) {
              URL.revokeObjectURL(editorSrc);
            }
            setEditorSrc(null);
          }}
        />
      )}
    </div>
  );
}