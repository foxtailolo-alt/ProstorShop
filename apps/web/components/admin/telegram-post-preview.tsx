"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  appendTelegramStoreFooter,
  buildTelegramPostText,
} from "../../lib/telegram-post-template";

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
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("Открыть в Mini App");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selected = products.find((p) => p.slug === selectedSlug);
  const priceText = selected ? `${Number(selected.price).toLocaleString("ru-RU")} ₽` : "";
  const previewText = buildTelegramPostText({ title, description, priceText });

  const handleAppendStoreFooter = () => {
    if (!priceText) {
      return;
    }

    setDescription((currentValue) => appendTelegramStoreFooter(currentValue, priceText));
  };

  return (
    <div className="grid grid-2" style={{ gap: 18, marginTop: 18 }}>
      <div className="card glass admin-form-card">
        <div className="section-label">Создать пост</div>
        <form
          action={async (formData) => {
            setFeedback(null);
            setIsSubmitting(true);

            try {
              await publishAction(formData);
              setFeedback({
                type: "success",
                message: "Пост опубликован. История публикаций обновлена.",
              });
              setTitle("");
              setDescription("");
              setCtaText("Открыть в Mini App");
              router.refresh();
            } catch (error) {
              setFeedback({
                type: "error",
                message: error instanceof Error ? error.message : "Не удалось опубликовать пост.",
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
          style={{ width: "100%", display: "block" }}
        >
          <fieldset
            disabled={isSubmitting}
            style={{ border: 0, padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, width: "100%" }}
          >
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
                rows={9}
                placeholder="Коротко и по делу: что это за товар, почему он интересен."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
            <div className="actions field-wide">
              <button className="button button-secondary button-sm" type="button" onClick={handleAppendStoreFooter}>
                Добавить шаблон магазина
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                Подставит цену, адрес, график и контакты в описание. Повторно блок не дублируется.
              </span>
            </div>
            <label className="field">
              <span>Текст кнопки</span>
              <input
                name="ctaText"
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
              />
            </label>
            {feedback ? (
              <div
                className="field field-wide"
                style={{
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  background: feedback.type === "success" ? "rgba(45, 122, 79, 0.12)" : "rgba(176, 61, 61, 0.12)",
                  color: feedback.type === "success" ? "#1f6b43" : "#9f3535",
                }}
              >
                {feedback.message}
              </div>
            ) : null}
            <div className="actions field-wide" style={{ width: "100%" }}>
              <button className="button button-primary" type="submit" disabled={isSubmitting} style={{ width: "100%", justifyContent: "center" }}>
                {isSubmitting ? "Публикуем..." : "Опубликовать в Telegram"}
              </button>
            </div>
          </fieldset>
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
            {previewText.split("\n").map((line, index) => (
              <div key={`${line}-${index}`} style={{ marginBottom: line ? 0 : 14 }}>
                {index === 0 && title ? <strong>{line}</strong> : line || <span>&nbsp;</span>}
              </div>
            ))}
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
