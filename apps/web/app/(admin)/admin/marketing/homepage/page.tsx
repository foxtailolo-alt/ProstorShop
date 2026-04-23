import { prisma } from "@prostor/db";
import { redirect } from "next/navigation";
import { isMarketingMode } from "../../../../../lib/auth/marketing";
import { loadCategoryTree, buildFlatCategoryOptions } from "../../../../../lib/data/catalog";
import { CategoryImageCard } from "../../../../../components/admin/category-image-card";
import { ConfirmButton } from "../../../../../components/admin/confirm-button";
import { SearchableProductPicker } from "../../../../../components/admin/searchable-product-picker";
import {
  upsertSectionAction,
  deleteSectionAction,
  addItemToSectionAction,
  removeItemFromSectionAction,
  toggleItemHighlightAction,
  reorderItemAction,
  updateCategoryImageAction,
} from "./actions";

export default async function AdminHomepagePage() {
  const marketingMode = await isMarketingMode();
  if (!marketingMode) redirect("/admin");

  const [sections, dbProducts, categoryTree] = await Promise.all([
    prisma.homepageSection.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: { product: { include: { category: true } } },
        },
      },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, brand: true, price: true, imageUrl: true, imageUrls: true },
    }),
    loadCategoryTree(),
  ]);

  const categoryOptions = buildFlatCategoryOptions(categoryTree);

  return (
    <main>
      <section className="admin-header glass">
        <h2 style={{ margin: 0 }}>Управление главной страницей</h2>
      </section>

      {/* Создание новой секции */}
      <section style={{ marginTop: 16 }} className="card glass">
        <div className="section-label">Добавить секцию</div>
        <form action={upsertSectionAction} style={{ display: "grid", gridTemplateColumns: "1fr 150px 80px auto auto", gap: 10, alignItems: "end" }}>
          <div className="admin-modal-field">
            <span>Название</span>
            <input type="text" name="title" placeholder="Бестселлеры" required />
          </div>
          <div className="admin-modal-field">
            <span>Тип</span>
            <select name="type">
              <option value="bestsellers">Бестселлеры</option>
              <option value="recommendations">Рекомендации</option>
              <option value="custom">Произвольный</option>
            </select>
          </div>
          <div className="admin-modal-field">
            <span>Порядок</span>
            <input type="number" name="sortOrder" defaultValue={0} style={{ width: 70 }} />
          </div>
          <label className="admin-modal-field" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 22 }}>
            <input type="checkbox" name="isActive" defaultChecked />
            <span>Активна</span>
          </label>
          <button className="button button-primary button-sm" type="submit" style={{ alignSelf: "end" }}>
            Создать
          </button>
        </form>
      </section>

      {/* Список секций */}
      {sections.map((section) => {
        const sectionProducts = section.items.filter((item) => item.product);
        const usedProductIds = new Set(sectionProducts.map((item) => item.productId));
        const availableProducts = dbProducts.filter((p) => !usedProductIds.has(p.id));

        return (
          <section key={section.id} style={{ marginTop: 16 }} className="card glass">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div className="section-label" style={{ margin: 0 }}>
                  {section.type === "bestsellers" ? "⭐" : section.type === "recommendations" ? "💡" : "📦"}{" "}
                  {section.title}
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Порядок: {section.sortOrder} | {section.isActive ? "Активна" : "Скрыта"} | {sectionProducts.length} товаров
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <form action={deleteSectionAction}>
                  <input type="hidden" name="sectionId" value={section.id} />
                  <ConfirmButton className="button button-secondary button-sm" style={{ color: "var(--red)" }}>
                    Удалить секцию
                  </ConfirmButton>
                </form>
              </div>
            </div>

            {/* Редактирование секции */}
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--accent)" }}>Редактировать секцию</summary>
              <form action={upsertSectionAction} style={{ display: "grid", gridTemplateColumns: "1fr 150px 80px auto auto", gap: 10, alignItems: "end", marginTop: 8 }}>
                <input type="hidden" name="sectionId" value={section.id} />
                <div className="admin-modal-field">
                  <span>Название</span>
                  <input type="text" name="title" defaultValue={section.title} required />
                </div>
                <div className="admin-modal-field">
                  <span>Тип</span>
                  <select name="type" defaultValue={section.type}>
                    <option value="bestsellers">Бестселлеры</option>
                    <option value="recommendations">Рекомендации</option>
                    <option value="custom">Произвольный</option>
                  </select>
                </div>
                <div className="admin-modal-field">
                  <span>Порядок</span>
                  <input type="number" name="sortOrder" defaultValue={section.sortOrder} style={{ width: 70 }} />
                </div>
                <label className="admin-modal-field" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 22 }}>
                  <input type="checkbox" name="isActive" defaultChecked={section.isActive} />
                  <span>Активна</span>
                </label>
                <button className="button button-primary button-sm" type="submit" style={{ alignSelf: "end" }}>
                  Сохранить
                </button>
              </form>
            </details>

            {/* Товары в секции */}
            <div style={{ display: "grid", gap: 8 }}>
              {sectionProducts.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: item.isHighlighted ? "var(--accent-light)" : "var(--surface-strong)",
                    border: item.isHighlighted ? "1px solid var(--accent)" : "1px solid var(--line)",
                  }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: "var(--radius-sm)", overflow: "hidden", background: "#f0f0f0" }}>
                    {item.product?.imageUrls?.[0] || item.product?.imageUrl ? (
                      <img
                        src={item.product.imageUrls?.[0] ?? item.product.imageUrl ?? ""}
                        alt={item.product?.name ?? ""}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product?.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {item.product?.brand} • {Number(item.product?.price ?? 0).toLocaleString("ru-RU")} ₽
                      {item.isHighlighted ? " • ⭐ Выделенный" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <form action={reorderItemAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button className="button button-secondary button-sm" type="submit" disabled={idx === 0}>↑</button>
                    </form>
                    <form action={reorderItemAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button className="button button-secondary button-sm" type="submit" disabled={idx === sectionProducts.length - 1}>↓</button>
                    </form>
                    <form action={toggleItemHighlightAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button className="button button-secondary button-sm" type="submit" title="Переключить выделение">
                        {item.isHighlighted ? "☆" : "⭐"}
                      </button>
                    </form>
                  </div>
                  <form action={removeItemFromSectionAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="button button-secondary button-sm" type="submit" style={{ color: "var(--red)" }}>✕</button>
                  </form>
                </div>
              ))}
            </div>

            {/* Добавить товар */}
            <form action={addItemToSectionAction} style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "end", position: "relative", zIndex: 4 }}>
              <input type="hidden" name="sectionId" value={section.id} />
              <div className="admin-modal-field" style={{ flex: 1 }}>
                <span>Добавить товар</span>
                <SearchableProductPicker
                  name="productId"
                  products={availableProducts.map((product) => ({
                    id: product.id,
                    name: product.name,
                    brand: product.brand,
                    price: Number(product.price),
                  }))}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, whiteSpace: "nowrap" }}>
                <input type="checkbox" name="isHighlighted" />
                Выделить
              </label>
              <button className="button button-primary button-sm" type="submit">Добавить</button>
            </form>
          </section>
        );
      })}

      {/* Изображения категорий */}
      <section style={{ marginTop: 24 }} className="card glass">
        <div className="section-label">Изображения категорий</div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
          Загрузите изображения для отображения в блоке категорий на главной странице.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {categoryOptions.map((cat) => {
            const treeNode = findCategoryInTree(categoryTree, cat.id);
            return (
              <CategoryImageCard
                key={cat.id}
                categoryId={cat.id}
                label={cat.label}
                imageUrl={treeNode?.imageUrl ?? null}
                action={updateCategoryImageAction}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}

function findCategoryInTree(
  tree: { id: string; imageUrl: string | null; children: typeof tree }[],
  id: string,
): { imageUrl: string | null } | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findCategoryInTree(node.children, id);
    if (found) return found;
  }
  return null;
}
