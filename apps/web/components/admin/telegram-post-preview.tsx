"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  appendTelegramStoreFooter,
  buildTelegramPostPreviewHtml,
  buildTelegramPostText,
} from "../../lib/telegram-post-template";
import { buildPriceText, formatProductPrice } from "../../lib/pricing";

type Product = {
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  imageUrl: string | null;
  description: string | null;
  categorySlug: string;
  categoryName: string;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  discountEndsAt?: string;
};

type CategoryOption = {
  slug: string;
  name: string;
};

type TelegramPostFormProps = {
  products: Product[];
  categories: CategoryOption[];
  publishAction: (formData: FormData) => Promise<void>;
  applyDiscountAction: (formData: FormData) => Promise<void>;
  clearDiscountAction: (formData: FormData) => Promise<void>;
};

const TELEGRAM_FORMAT_ACTIONS = [
  { label: "Жирный", tag: "b" },
  { label: "Курсив", tag: "i" },
  { label: "Подчеркнутый", tag: "u" },
  { label: "Зачеркнутый", tag: "s" },
  { label: "Цитата", tag: "blockquote" },
  { label: "Моноширинный", tag: "code" },
  { label: "Скрытый", tag: "tg-spoiler" },
] as const;

function buildInputDateTimeValue(date?: string) {
  if (!date) {
    return "";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function TelegramPostForm({
  products,
  categories,
  publishAction,
  applyDiscountAction,
  clearDiscountAction,
}: TelegramPostFormProps) {
  const router = useRouter();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? "");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("Открыть в Mini App");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscountSubmitting, setIsDiscountSubmitting] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountDurationMode, setDiscountDurationMode] = useState<"forever" | "until-date">("forever");
  const [discountEndsAt, setDiscountEndsAt] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatch = !selectedCategorySlug || product.categorySlug === selectedCategorySlug;
      const searchMatch = !normalizedSearch || product.name.toLowerCase().includes(normalizedSearch);
      return categoryMatch && searchMatch;
    });
  }, [products, searchQuery, selectedCategorySlug]);

  const visibleProducts = useMemo(() => {
    const currentSelected = products.find((product) => product.slug === selectedSlug);

    if (!currentSelected) {
      return filteredProducts.length > 0 ? filteredProducts : products;
    }

    if (filteredProducts.some((product) => product.slug === currentSelected.slug)) {
      return filteredProducts;
    }

    return [currentSelected, ...filteredProducts];
  }, [filteredProducts, products, selectedSlug]);

  const selected = products.find((p) => p.slug === selectedSlug);
  const priceText = selected ? buildPriceText(selected.price, selected.compareAtPrice) : "";
  const previewText = buildTelegramPostText({ title, description, priceText });
  const previewHtml = buildTelegramPostPreviewHtml({ title, description, priceText });

  const activeDiscountSummary = selected?.compareAtPrice && selected.compareAtPrice > selected.price
    ? `${formatProductPrice(selected.compareAtPrice)} -> ${formatProductPrice(selected.price)}`
    : null;

  function syncSelection(nextSlug: string) {
    setSelectedSlug(nextSlug);
    const product = products.find((item) => item.slug === nextSlug);
    setDiscountType(product?.discountType ?? "percent");
    setDiscountValue(product?.discountValue ? String(product.discountValue) : "");
    setDiscountDurationMode(product?.discountEndsAt ? "until-date" : "forever");
    setDiscountEndsAt(buildInputDateTimeValue(product?.discountEndsAt));
  }

  useEffect(() => {
    if (!selected) {
      return;
    }

    setDiscountType(selected.discountType ?? "percent");
    setDiscountValue(selected.discountValue ? String(selected.discountValue) : "");
    setDiscountDurationMode(selected.discountEndsAt ? "until-date" : "forever");
    setDiscountEndsAt(buildInputDateTimeValue(selected.discountEndsAt));
  }, [selected]);

  const handleAppendStoreFooter = () => {
    if (!priceText) {
      return;
    }

    setDescription((currentValue) => appendTelegramStoreFooter(currentValue, priceText));
  };

  const handleInsertProductDescription = () => {
    const productDescription = selected?.description?.trim();

    if (!productDescription) {
      return;
    }

    setDescription((currentValue) => {
      const normalizedCurrent = currentValue.trim();

      if (!normalizedCurrent) {
        return productDescription;
      }

      if (normalizedCurrent.includes(productDescription)) {
        return currentValue;
      }

      return `${currentValue.trimEnd()}\n\n${productDescription}`;
    });
  };

  const handleFormatSelection = (tag: string) => {
    const textarea = descriptionRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = description.slice(start, end) || "текст";
    const before = description.slice(0, start);
    const after = description.slice(end);
    const nextValue = `${before}<${tag}>${selectedText}</${tag}>${after}`;

    setDescription(nextValue);

    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2 + selectedText.length);
    });
  };

  const handleApplyDiscount = async () => {
    if (!selected) {
      return;
    }

    setFeedback(null);
    setIsDiscountSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("productSlug", selected.slug);
      formData.set("discountType", discountType);
      formData.set("discountValue", discountValue);
      formData.set("discountDurationMode", discountDurationMode);
      if (discountDurationMode === "until-date") {
        formData.set("discountEndsAt", discountEndsAt);
      }

      await applyDiscountAction(formData);
      setFeedback({
        type: "success",
        message: "Скидка применена. Цена товара и предпросмотр будут обновлены.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Не удалось применить скидку.",
      });
    } finally {
      setIsDiscountSubmitting(false);
    }
  };

  const handleClearDiscount = async () => {
    if (!selected) {
      return;
    }

    setFeedback(null);
    setIsDiscountSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("productSlug", selected.slug);
      await clearDiscountAction(formData);
      setFeedback({
        type: "success",
        message: "Скидка снята. Базовая цена товара восстановлена.",
      });
      setDiscountValue("");
      setDiscountDurationMode("forever");
      setDiscountEndsAt("");
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Не удалось снять скидку.",
      });
    } finally {
      setIsDiscountSubmitting(false);
    }
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
            <label className="field">
              <span>Категория</span>
              <select
                value={selectedCategorySlug}
                onChange={(event) => setSelectedCategorySlug(event.target.value)}
              >
                <option value="">Все категории</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Поиск по названию</span>
              <input
                type="text"
                placeholder="Например, Apple Watch Ultra"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="field field-wide">
              <span>Товар</span>
              <select
                name="productSlug"
                value={selectedSlug}
                onChange={(e) => syncSelection(e.target.value)}
              >
                {visibleProducts.map((product) => (
                  <option key={product.slug} value={product.slug}>
                    {product.name} • {formatProductPrice(product.price)}
                    {product.compareAtPrice ? ` вместо ${formatProductPrice(product.compareAtPrice)}` : ""}
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
                ref={descriptionRef}
                name="description"
                rows={9}
                placeholder="Коротко и по делу: что это за товар, почему он интересен."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
            <div className="actions field-wide" style={{ gap: 8, flexWrap: "wrap" }}>
              {TELEGRAM_FORMAT_ACTIONS.map((item) => (
                <button
                  key={item.tag}
                  className="button button-secondary button-sm"
                  type="button"
                  onClick={() => handleFormatSelection(item.tag)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="actions field-wide">
              <button className="button button-secondary button-sm" type="button" onClick={handleAppendStoreFooter}>
                Добавить шаблон магазина
              </button>
              <button className="button button-secondary button-sm" type="button" onClick={handleInsertProductDescription}>
                Вставить описание товара
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                Шаблон магазина подставит цену, адрес, график и контакты. Описание товара добавляется без дублей.
              </span>
            </div>
            <div className="field field-wide" style={{ border: "1px solid rgba(91, 112, 163, 0.16)", borderRadius: "var(--radius-md)", padding: 14 }}>
              <span style={{ display: "block", marginBottom: 10, fontWeight: 600 }}>Скидка на товар</span>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <label className="field">
                  <span>Тип скидки</span>
                  <select value={discountType} onChange={(event) => setDiscountType(event.target.value as "percent" | "fixed")}>
                    <option value="percent">Проценты</option>
                    <option value="fixed">Рубли</option>
                  </select>
                </label>
                <label className="field">
                  <span>Значение</span>
                  <input
                    type="number"
                    min={1}
                    max={discountType === "percent" ? 99 : undefined}
                    step={1}
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    placeholder={discountType === "percent" ? "10" : "5000"}
                  />
                </label>
                <label className="field">
                  <span>Срок действия</span>
                  <select
                    value={discountDurationMode}
                    onChange={(event) => setDiscountDurationMode(event.target.value as "forever" | "until-date")}
                  >
                    <option value="forever">Навсегда</option>
                    <option value="until-date">До даты</option>
                  </select>
                </label>
                {discountDurationMode === "until-date" ? (
                  <label className="field">
                    <span>Дата окончания</span>
                    <input
                      type="datetime-local"
                      value={discountEndsAt}
                      onChange={(event) => setDiscountEndsAt(event.target.value)}
                    />
                  </label>
                ) : <div />}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                {selected
                  ? activeDiscountSummary
                    ? `Сейчас действует скидка: ${activeDiscountSummary}${selected.discountEndsAt ? ` до ${new Date(selected.discountEndsAt).toLocaleString("ru-RU")}` : ", без даты окончания"}.`
                    : `Текущая цена товара: ${formatProductPrice(selected.price)}.`
                  : "Сначала выберите товар."}
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="button button-secondary button-sm" type="button" disabled={!selected || isDiscountSubmitting} onClick={handleApplyDiscount}>
                  {isDiscountSubmitting ? "Применяем..." : "Применить скидку"}
                </button>
                <button className="button button-secondary button-sm" type="button" disabled={!selected || isDiscountSubmitting} onClick={handleClearDiscount}>
                  Снять скидку
                </button>
              </div>
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
          <div
            style={{ whiteSpace: "normal", fontSize: 14, lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          >
          </div>
        ) : (
          <p className="muted">Заполните форму, чтобы увидеть предпросмотр.</p>
        )}
        {(title || description) && previewText && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              {selected ? `Цена в посте: ${selected.compareAtPrice ? `${formatProductPrice(selected.compareAtPrice)} -> ${formatProductPrice(selected.price)}` : formatProductPrice(selected.price)}` : null}
            </div>
            <span className="button button-primary button-sm" style={{ pointerEvents: "none" }}>
              {ctaText || "Открыть в Mini App"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
