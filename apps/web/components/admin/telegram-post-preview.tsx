"use client";

import { useState } from "react";

type Product = {
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

type TelegramPostFormProps = {
  products: Product[];
  publishAction: (formData: FormData) => Promise<void>;
};

export function TelegramPostForm({ products, publishAction }: TelegramPostFormProps) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("Открыть в Mini App");

  const selected = products.find((p) => p.slug === selectedSlug);

  return (
    <div className="grid grid-2" style={{ gap: 18, marginTop: 18 }}>
      <div className="card glass admin-form-card">
        <div className="section-label">Создать пост</div>
        <form action={publishAction} className="form-grid">
          <label className="field field-wide">
            <span>Товар</span>
            <select
              name="productSlug"
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
            >
              {products.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.name} • {Number(product.price).toLocaleString("ru-RU")} ₽
                  {product.imageUrl ? " • с фото" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-wide">
            <span>Заголовок</span>
            <input
              name="title"
              type="text"
              placeholder="Новый iPhone уже в Просторе"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="field field-wide">
            <span>Описание</span>
            <textarea
              name="description"
              rows={5}
              placeholder="Коротко и по делу: что это за товар, почему он интересен."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Текст кнопки</span>
            <input
              name="ctaText"
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
            />
          </label>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">
              Опубликовать в Telegram
            </button>
          </div>
        </form>
      </div>

      <div className="card glass">
        <div className="section-label">Предпросмотр</div>
        {selected?.imageUrl && (
          <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 12 }}>
            <img
              src={selected.imageUrl}
              alt={selected.name}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        )}
        {title || description ? (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
            {title && <strong>{title}</strong>}
            {title && description && <><br /><br /></>}
            {description}
            {selected && (
              <>
                <br /><br />
                💰 {Number(selected.price).toLocaleString("ru-RU")} ₽
              </>
            )}
          </div>
        ) : (
          <p className="muted">Заполните форму, чтобы увидеть предпросмотр.</p>
        )}
        {(title || description) && (
          <div style={{ marginTop: 12 }}>
            <span className="button button-primary button-sm" style={{ pointerEvents: "none" }}>
              {ctaText || "Открыть в Mini App"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
