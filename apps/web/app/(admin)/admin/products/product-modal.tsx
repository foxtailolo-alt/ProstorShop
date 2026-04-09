"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { ImageGalleryManager } from "./image-gallery-manager";
import { ProductOptionsEditor, type ProductOptionsData } from "./product-options-editor";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  price: number;
};

type ProductData = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  inStock: boolean;
  categorySlug: string;
  seoTitle: string;
  seoDescription: string;
  imageUrls: string[];
  recommendedIds: string[];
  specs: Record<string, string>;
  options: ProductOptionsData;
} | null;

type ProductModalProps = {
  open: boolean;
  product: ProductData;
  categories: CategoryNode[];
  allProducts: ProductOption[];
  onClose: () => void;
  upsertAction: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
};

function ProductSubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? "Сохраняем..." : isEditing ? "Сохранить" : "Создать"}
    </button>
  );
}

export function ProductModal({
  open,
  product,
  categories,
  allProducts,
  onClose,
  upsertAction,
}: ProductModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formState, formAction] = useActionState(upsertAction, { error: null });
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(
    product?.categorySlug ?? categories[0]?.slug ?? "",
  );
  const [recommendedIds, setRecommendedIds] = useState<string[]>(
    product?.recommendedIds ?? [],
  );
  const [imageUrls, setImageUrls] = useState<string[]>(product?.imageUrls ?? []);
  const [recSearch, setRecSearch] = useState("");
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>(
    product?.specs
      ? Object.entries(product.specs).map(([key, value]) => ({ key, value }))
      : [],
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [productOptions, setProductOptions] = useState<ProductOptionsData>(
    product?.options ?? null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    setSelectedCategorySlug(product?.categorySlug ?? categories[0]?.slug ?? "");
    setRecommendedIds(product?.recommendedIds ?? []);
    setImageUrls(product?.imageUrls ?? []);
    setRecSearch("");
    setSpecs(
      product?.specs
        ? Object.entries(product.specs).map(([key, value]) => ({ key, value }))
        : [],
    );
    setAiLoading(false);
    setAiError(null);
    setProductOptions(product?.options ?? null);
  }, [product, categories]);

  // Build flat options with indentation for tree categories
  const flatOptions: { slug: string; label: string }[] = [];
  function walkTree(nodes: CategoryNode[], depth: number) {
    for (const node of nodes) {
      const prefix = depth > 0 ? "— ".repeat(depth) : "";
      flatOptions.push({ slug: node.slug, label: `${prefix}${node.name}` });
      if (node.children.length > 0) {
        walkTree(node.children, depth + 1);
      }
    }
  }
  const rootCategories = categories.filter((c) => !c.parentId);
  walkTree(rootCategories, 0);

  // Filter products for recommendations (exclude self)
  const availableForRec = allProducts.filter(
    (p) => p.id !== product?.id && (
      !recSearch ||
      p.name.toLowerCase().includes(recSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(recSearch.toLowerCase())
    ),
  );

  function toggleRec(id: string) {
    setRecommendedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function updateSpec(index: number, field: "key" | "value", val: string) {
    setSpecs((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: val } : s)));
  }

  function removeSpec(index: number) {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  }

  function addSpec() {
    setSpecs((prev) => [...prev, { key: "", value: "" }]);
  }

  async function fillWithAI() {
    const form = dialogRef.current?.querySelector("form");
    if (!form) return;
    const nameInput = form.querySelector<HTMLInputElement>("[name='name']");
    const brandInput = form.querySelector<HTMLInputElement>("[name='brand']");
    const productName = nameInput?.value?.trim();
    const productBrand = brandInput?.value?.trim();

    if (!productName) return;

    setAiError(null);
    setAiLoading(true);
    try {
      const categoryLabel = flatOptions.find((o) => o.slug === selectedCategorySlug)?.label ?? "";
      const res = await fetch("/api/ai/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: productName, brand: productBrand, category: categoryLabel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAiError(err.error ?? res.statusText);
        return;
      }
      const data = await res.json();
      if (data.specs && typeof data.specs === "object") {
        const aiSpecs = Object.entries(data.specs as Record<string, string>).map(
          ([key, value]) => ({ key, value }),
        );
        // Merge: keep existing keys, add new from AI
        setSpecs((prev) => {
          const existingKeys = new Set(prev.map((s) => s.key.toLowerCase()));
          const newSpecs = aiSpecs.filter((s) => !existingKeys.has(s.key.toLowerCase()));
          return [...prev, ...newSpecs];
        });
      }
    } catch {
      setAiError("Не удалось получить характеристики от ИИ.");
    } finally {
      setAiLoading(false);
    }
  }

  function generateSku(name: string, brand: string): string {
    const translitMap: Record<string, string> = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
      з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
      п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
      ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    };
    const translit = (s: string) =>
      s.toLowerCase().split("").map((c) => translitMap[c] ?? c).join("");

    const parts = [brand, ...name.split(/\s+/)].filter(Boolean);
    const slug = parts
      .map((p) => translit(p).replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
      .slice(0, 5)
      .join("-")
      .toUpperCase();
    return slug || "SKU";
  }

  function handleNameBlur() {
    const form = dialogRef.current?.querySelector("form");
    if (!form) return;
    const skuInput = form.querySelector<HTMLInputElement>("[name='sku']");
    if (!skuInput || skuInput.value.trim()) return; // don't overwrite existing
    const nameVal = form.querySelector<HTMLInputElement>("[name='name']")?.value?.trim() ?? "";
    const brandVal = form.querySelector<HTMLInputElement>("[name='brand']")?.value?.trim() ?? "";
    if (nameVal) skuInput.value = generateSku(nameVal, brandVal);
  }

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="admin-modal" onClose={onClose}>
      <div className="admin-modal-content">
        <div className="admin-modal-header">
          <h3 style={{ margin: 0 }}>{product ? "Редактирование товара" : "Новый товар"}</h3>
          <button type="button" className="admin-modal-close" onClick={handleClose}>✕</button>
        </div>

        <form key={product?.id ?? "new"} action={formAction} className="admin-modal-body">
          <input type="hidden" name="productId" value={product?.id ?? ""} />
          <input type="hidden" name="originalSku" value={product?.sku ?? ""} />
          <input type="hidden" name="imageUrls" value={imageUrls.join("\n")} />
          <input type="hidden" name="seoTitle" value={product?.seoTitle ?? ""} />
          <input type="hidden" name="seoDescription" value={product?.seoDescription ?? ""} />
          <input type="hidden" name="recommendedIds" value={recommendedIds.join(",")} />
          <input type="hidden" name="options" value={productOptions ? JSON.stringify(productOptions) : ""} />
          <input
            type="hidden"
            name="specs"
            value={JSON.stringify(
              Object.fromEntries(specs.filter((s) => s.key.trim()).map((s) => [s.key.trim(), s.value.trim()])),
            )}
          />

          <div className="admin-modal-grid">
            <label className="admin-modal-field">
              <span>Название</span>
              <input name="name" type="text" placeholder="iPhone 16 256 GB" defaultValue={product?.name ?? ""} required onBlur={handleNameBlur} />
            </label>

            <label className="admin-modal-field">
              <span>Категория</span>
              <select
                name="categorySlug"
                required
                value={selectedCategorySlug}
                onChange={(e) => setSelectedCategorySlug(e.target.value)}
              >
                {flatOptions.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label className="admin-modal-field">
              <span>Цена</span>
              <input name="price" type="number" min="1" step="1" placeholder="99990" defaultValue={product?.price ?? ""} required />
            </label>

            <label className="admin-modal-field">
              <span>Бренд</span>
              <input name="brand" type="text" placeholder="Apple" defaultValue={product?.brand ?? ""} required onBlur={handleNameBlur} />
            </label>

            <label className="admin-modal-field">
              <span>SKU</span>
              <input name="sku" type="text" placeholder="APL-IP16-256-BLK" defaultValue={product?.sku ?? ""} required />
            </label>

            <label className="admin-modal-field admin-modal-field-check">
              <input name="inStock" type="checkbox" defaultChecked={product?.inStock ?? true} />
              <span>В наличии</span>
            </label>
          </div>

          <label className="admin-modal-field">
            <span>Описание</span>
            <textarea name="description" rows={3} placeholder="Описание товара" defaultValue={product?.description ?? ""} />
          </label>

          {formState.error ? (
            <p className="auth-error" style={{ margin: 0 }}>
              {formState.error}
            </p>
          ) : null}

          {/* Specs editor */}
          <div className="admin-modal-field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Характеристики</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={addSpec}
                >
                  + Добавить
                </button>
                <button
                  type="button"
                  className="button button-primary button-sm"
                  onClick={fillWithAI}
                  disabled={aiLoading}
                >
                  {aiLoading ? "Загрузка..." : "✨ Заполнить ИИ"}
                </button>
              </div>
            </div>
            {specs.length > 0 && (
              <div className="admin-specs-list">
                {specs.map((spec, i) => (
                  <div key={i} className="admin-specs-row">
                    <input
                      type="text"
                      placeholder="Название"
                      value={spec.key}
                      onChange={(e) => updateSpec(i, "key", e.target.value)}
                      className="admin-specs-key"
                    />
                    <input
                      type="text"
                      placeholder="Значение"
                      value={spec.value}
                      onChange={(e) => updateSpec(i, "value", e.target.value)}
                      className="admin-specs-value"
                    />
                    <button type="button" className="admin-specs-remove" onClick={() => removeSpec(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {specs.length === 0 && !aiLoading && (
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                Нет характеристик. Добавьте вручную или нажмите «Заполнить ИИ».
              </p>
            )}
            {aiError ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#9f3535" }}>
                {aiError}
              </p>
            ) : null}
          </div>

          {/* Options editor */}
          <ProductOptionsEditor initial={product?.options ?? null} onChange={setProductOptions} />

          <label className="admin-modal-field">
            <span>Добавить фото (JPG/PNG/WebP, до 10)</span>
            <input name="imageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          </label>

          {product && imageUrls.length > 0 && (
            <ImageGalleryManager
              sku={product.sku}
              imageUrls={imageUrls}
              productName={product.name}
              onChange={setImageUrls}
            />
          )}

          {/* Recommended products */}
          <div className="admin-modal-field">
            <span>Рекомендуемые товары</span>
            {recommendedIds.length > 0 && (
              <div className="admin-rec-selected">
                {recommendedIds.map((rid) => {
                  const rp = allProducts.find((p) => p.id === rid);
                  if (!rp) return null;
                  return (
                    <div key={rid} className="admin-rec-tag">
                      {rp.imageUrl && <img src={rp.imageUrl} alt="" className="admin-rec-tag-img" />}
                      <span>{rp.name}</span>
                      <button type="button" className="admin-rec-tag-remove" onClick={() => toggleRec(rid)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <input
              type="text"
              placeholder="Поиск товаров для рекомендаций..."
              value={recSearch}
              onChange={(e) => setRecSearch(e.target.value)}
              className="admin-rec-search"
            />
            {recSearch && (
              <div className="admin-rec-dropdown">
                {availableForRec.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`admin-rec-option ${recommendedIds.includes(p.id) ? "admin-rec-option-active" : ""}`}
                    onClick={() => toggleRec(p.id)}
                  >
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="admin-rec-option-img" />}
                    <div>
                      <div>{p.name}</div>
                      <div className="muted">{p.sku} — {p.price.toLocaleString("ru-RU")} ₽</div>
                    </div>
                    {recommendedIds.includes(p.id) && <span className="admin-rec-check">✓</span>}
                  </button>
                ))}
                {availableForRec.length === 0 && (
                  <div className="admin-rec-empty muted">Ничего не найдено</div>
                )}
              </div>
            )}
          </div>

          <div className="admin-modal-actions">
            <ProductSubmitButton isEditing={Boolean(product)} />
            <button className="button button-secondary" type="button" onClick={handleClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
