import Link from "next/link";
import { prisma } from "@prostor/db";
import {
  deleteCategoryAction,
  upsertCategoryAction,
} from "./actions";
import { ConfirmButton } from "../../../../components/admin/confirm-button";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; parent?: string }>;
}) {
  const params = await searchParams;
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      children: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { products: true, children: true } },
        },
      },
      _count: {
        select: { products: true, children: true },
      },
    },
  });

  const rootCategories = categories.filter((c) => !c.parentId);
  const allFlat = [
    ...categories,
    ...categories.flatMap((c) => c.children),
  ];

  const editCategory = params.edit
    ? allFlat.find((c) => c.id === params.edit) ?? null
    : null;

  // Which parent are we browsing into?
  const browseParentId = params.parent ?? null;
  const browseParent = browseParentId
    ? categories.find((c) => c.id === browseParentId) ?? null
    : null;

  // What to show in the list
  const visibleCategories = browseParent
    ? browseParent.children
    : rootCategories;

  return (
    <main>
      {/* Header */}
      <section className="admin-header glass">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {browseParent ? (
            <>
              <Link href="/admin/categories" className="button button-secondary button-sm">← Все категории</Link>
              <h2 style={{ margin: 0 }}>{browseParent.name}</h2>
              <span className="pill pill-compact">{browseParent.children.length} подкатегорий</span>
            </>
          ) : (
            <>
              <h2 style={{ margin: 0 }}>Категории</h2>
              <span className="pill pill-compact">{rootCategories.length}</span>
            </>
          )}
        </div>
      </section>

      {/* Add / Edit form */}
      <section style={{ marginTop: 16 }} className="card glass admin-form-card">
        <div className="section-label">
          {editCategory ? `Редактирование: ${editCategory.name}` : "Новая категория"}
        </div>
        <form action={upsertCategoryAction} className="admin-inline-form">
          {editCategory && <input type="hidden" name="categoryId" value={editCategory.id} />}
          {browseParent && !editCategory && <input type="hidden" name="parentId" value={browseParent.id} />}
          {editCategory && "parentId" in editCategory && editCategory.parentId && (
            <input type="hidden" name="parentId" value={editCategory.parentId} />
          )}
          <input name="name" type="text" placeholder="Название" defaultValue={editCategory?.name ?? ""} required className="admin-inline-input" />
          <input name="slug" type="text" placeholder="slug" defaultValue={editCategory?.slug ?? ""} className="admin-inline-input admin-inline-input-sm" />
          <button className="button button-primary button-sm" type="submit">
            {editCategory ? "Сохранить" : "Создать"}
          </button>
          {editCategory && (
            <Link className="button button-secondary button-sm" href={browseParent ? `/admin/categories?parent=${browseParent.id}` : "/admin/categories"}>
              Отмена
            </Link>
          )}
        </form>
      </section>

      {/* Category list */}
      <section style={{ marginTop: 16 }}>
        {visibleCategories.length === 0 ? (
          <div className="card glass" style={{ padding: 24, textAlign: "center" }}>
            <p className="muted">Нет категорий. Создайте первую выше.</p>
          </div>
        ) : (
          <div className="admin-cat-list">
            {visibleCategories.map((category) => {
              const childCount = "_count" in category ? (category._count as { children?: number }).children ?? 0 : 0;
              const productCount = "_count" in category ? (category._count as { products?: number }).products ?? 0 : 0;

              return (
                <div key={category.id} className="admin-cat-item card glass">
                  <div className="admin-cat-item-info">
                    <strong className="admin-cat-item-name">{category.name}</strong>
                    <span className="muted admin-cat-item-slug">/{category.slug}</span>
                    {productCount > 0 && <span className="pill pill-compact pill-muted">{productCount} товаров</span>}
                    {childCount > 0 && <span className="pill pill-compact">{childCount} подкатегорий</span>}
                  </div>
                  <div className="admin-cat-item-actions">
                    {childCount > 0 || !browseParent ? (
                      <Link
                        className="button button-secondary button-sm"
                        href={`/admin/categories?parent=${category.id}` as "/"}
                      >
                        {childCount > 0 ? "Открыть" : "Подкатегории"}
                      </Link>
                    ) : null}
                    <Link
                      className="button button-primary button-sm"
                      href={`/admin/categories?edit=${category.id}${browseParent ? `&parent=${browseParent.id}` : ""}` as "/"}
                    >
                      Изменить
                    </Link>
                    <form action={deleteCategoryAction} style={{ display: "inline" }}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <ConfirmButton message={`Удалить «${category.name}»?`} className="button button-secondary button-sm">
                        Удалить
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}