import { prisma } from "@prostor/db";
import { listCatalogCategories, listCatalogProducts } from "../../../../lib/data/catalog";
import { deleteBannerAction, toggleBannerActiveAction, upsertBannerAction } from "./actions";
import { ConfirmButton } from "../../../../components/admin/confirm-button";

export default async function AdminBannersPage() {
  const [banners, categories, products] = await Promise.all([
    prisma.banner.findMany({ orderBy: { sortOrder: "asc" } }),
    listCatalogCategories(),
    listCatalogProducts(),
  ]);

  const activeBannerCount = banners.filter((b) => b.isActive).length;

  const linkOptions = [
    ...categories.map((c) => ({ label: `Категория: ${c.name}`, value: `/catalog/${c.slug}` })),
    ...products.map((p) => ({ label: `${p.brand} ${p.name}`, value: `/catalog/${p.categorySlug}/${p.slug}` })),
  ];

  return (
    <div className="admin-panel-card">
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700 }}>Баннеры</h1>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Карусель на главной странице. Активных: {activeBannerCount}/5
        </p>
      </div>

      <details className="card glass" open>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16 }}>
          Добавить баннер
        </summary>
        <form action={upsertBannerAction} style={{ marginTop: 16 }}>
          <div className="form-grid">
            <div className="field">
              <span>Заголовок (необязательно)</span>
              <input type="text" name="title" placeholder="Скидки на iPhone" />
            </div>
            <div className="field">
              <span>Ссылка</span>
              <select name="linkUrl" required>
                <option value="">Выберите страницу...</option>
                {linkOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <span>Изображение</span>
              <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" required />
              <small style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, display: "block" }}>
                Рекомендуемый размер: <strong>2100 × 900 px</strong> (21:9). Формат: JPG, PNG или WebP
              </small>
            </div>
            <div className="field">
              <span>Порядок</span>
              <input type="number" name="sortOrder" defaultValue={banners.length} min={0} />
            </div>
            <div className="field-checkbox">
              <input type="checkbox" name="isActive" id="newBannerActive" defaultChecked />
              <label htmlFor="newBannerActive">Активен</label>
            </div>
          </div>
          <input type="hidden" name="existingImageUrl" value="" />
          <div className="actions" style={{ marginTop: 14 }}>
            <button type="submit" className="button button-primary button-sm">Создать баннер</button>
          </div>
        </form>
      </details>

      {banners.length === 0 ? (
        <div className="card glass" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-secondary)" }}>Баннеров пока нет. Создайте первый выше.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {banners.map((banner) => (
            <div key={banner.id} className="card glass" style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 16, alignItems: "center" }}>
              <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "16/9", background: "var(--bg)" }}>
                <img
                  src={banner.imageUrl}
                  alt={banner.title ?? "Баннер"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <strong style={{ fontSize: 15 }}>{banner.title || "Без заголовка"}</strong>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>→ {banner.linkUrl}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Порядок: {banner.sortOrder} · {banner.isActive ? "✅ Активен" : "⏸ Неактивен"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                <form action={toggleBannerActiveAction}>
                  <input type="hidden" name="bannerId" value={banner.id} />
                  <button type="submit" className="button button-secondary button-sm" style={{ width: "100%" }}>
                    {banner.isActive ? "Деактивировать" : "Активировать"}
                  </button>
                </form>
                <form action={deleteBannerAction}>
                  <input type="hidden" name="bannerId" value={banner.id} />
                  <ConfirmButton message="Удалить баннер?" className="button button-secondary button-sm" >
                    Удалить
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
