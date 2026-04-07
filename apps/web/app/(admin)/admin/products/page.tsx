import Link from "next/link";
import { prisma } from "@prostor/db";
import { listCatalogCategories } from "../../../../lib/data/catalog";
import {
  deleteProductAction,
  toggleProductStockAction,
  updateProductAttributeAction,
  upsertProductAction,
} from "./actions";
import { ImageGalleryManager } from "./image-gallery-manager";

type AdminProductsPageProps = {
  searchParams: Promise<{
    edit?: string;
  }>;
};

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  const [categories, productRecords] = await Promise.all([
    listCatalogCategories(),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: {
          include: {
            attributes: {
              orderBy: { label: "asc" },
            },
          },
        },
        attributes: {
          include: {
            definition: true,
          },
        },
      },
    }),
  ]);

  const selectedProduct = params.edit
    ? productRecords.find((product) => product.sku === params.edit) ?? null
    : null;
  const selectedProductImageUrls = selectedProduct
    ? Array.from(
        new Set([
          ...(selectedProduct.imageUrls ?? []),
          ...(selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []),
        ]),
      )
    : [];
  const productsInStock = productRecords.filter((product) => product.inStock).length;
  const productsOutOfStock = productRecords.length - productsInStock;

  return (
    <main>
      <section className="hero glass">
        <div className="section-label">Товары</div>
        <h1>Управление каталогом, а не демонстрация CRUD.</h1>
        <p>
          Здесь должен быть быстрый цикл работы менеджера: найти позицию, отредактировать карточку,
          поменять наличие, обновить SEO и характеристики без ручных правок в коде.
        </p>
        <div className="actions">
          <div className="pill">Всего товаров: {productRecords.length}</div>
          <div className="pill">В наличии: {productsInStock}</div>
          <div className="pill">Под заказ: {productsOutOfStock}</div>
          <Link className="button button-primary" href="/admin/products">
            Новый товар
          </Link>
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="card glass admin-form-card">
        <div className="section-label">{selectedProduct ? "Редактирование товара" : "Новый товар"}</div>
        <form action={upsertProductAction} className="form-grid">
          <input type="hidden" name="productId" value={selectedProduct?.id ?? ""} />
          <input type="hidden" name="originalSku" value={selectedProduct?.sku ?? ""} />
          <label className="field">
            <span>SKU</span>
            <input name="sku" type="text" placeholder="APL-IP16-256-BLK" defaultValue={selectedProduct?.sku ?? ""} required />
          </label>
          <label className="field">
            <span>Название</span>
            <input name="name" type="text" placeholder="iPhone 16 256 GB" defaultValue={selectedProduct?.name ?? ""} required />
          </label>
          <label className="field">
            <span>Бренд</span>
            <input name="brand" type="text" placeholder="Apple" defaultValue={selectedProduct?.brand ?? ""} required />
          </label>
          <label className="field">
            <span>Категория</span>
            <select name="categorySlug" required defaultValue={selectedProduct?.category.slug ?? categories[0]?.slug}>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Цена</span>
            <input name="price" type="number" min="1" step="1" placeholder="99990" defaultValue={selectedProduct ? Number(selectedProduct.price) : ""} required />
          </label>
          <label className="field field-wide">
            <span>Изображения</span>
            <textarea
              name="imageUrls"
              rows={5}
              placeholder={"https://site.com/cover.jpg\nhttps://site.com/gallery-2.jpg"}
              defaultValue={selectedProductImageUrls.join("\n")}
            />
          </label>
          <label className="field field-wide">
            <span>Загрузить до 10 изображений</span>
            <input name="imageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          </label>
          <label className="field field-checkbox">
            <input name="inStock" type="checkbox" defaultChecked={selectedProduct?.inStock ?? true} />
            <span>В наличии</span>
          </label>
          <label className="field field-wide">
            <span>Краткое описание</span>
            <textarea name="description" rows={4} placeholder="Короткое описание для карточки и SEO-основы." defaultValue={selectedProduct?.description ?? ""} />
          </label>
          <label className="field field-wide">
            <span>SEO title</span>
            <input name="seoTitle" type="text" placeholder="Купить iPhone 16 в Просторе" defaultValue={selectedProduct?.seoTitle ?? ""} />
          </label>
          <label className="field field-wide">
            <span>SEO description</span>
            <textarea name="seoDescription" rows={3} placeholder="Короткое описание для сниппета и рекламы." defaultValue={selectedProduct?.seoDescription ?? ""} />
          </label>
          <div className="actions field-wide">
            <button className="button button-primary" type="submit">
              {selectedProduct ? "Сохранить изменения" : "Создать товар"}
            </button>
            {selectedProduct ? (
              <Link className="button button-secondary" href="/admin/products">
                Сбросить форму
              </Link>
            ) : null}
            <div className="muted">Первая ссылка станет главным изображением. Можно хранить до 10 изображений. Поддерживаются JPG, PNG и WebP до 5 МБ.</div>
          </div>
        </form>
        {selectedProductImageUrls.length > 0 ? (
          <ImageGalleryManager
            sku={selectedProduct!.sku}
            imageUrls={selectedProductImageUrls}
            productName={selectedProduct!.name}
          />
        ) : null}
      </section>

      <section style={{ marginTop: 18 }} className="card glass">
        <div className="section-label">Каталог из базы данных</div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <div>Товар</div>
            <div>Категория</div>
            <div>Цена</div>
            <div>Статус</div>
            <div>Действия</div>
          </div>
          {productRecords.map((product) => (
            <div key={product.id} className="admin-table-row admin-product-row">
              <div>
                <strong>{product.name}</strong>
                <div className="muted">{product.sku}</div>
                {Math.max((product.imageUrls ?? []).length, product.imageUrl ? 1 : 0) > 0 ? (
                  <div className="muted">
                    Изображений: {Math.max((product.imageUrls ?? []).length, product.imageUrl ? 1 : 0)}
                  </div>
                ) : null}
                {product.seoTitle ? <div className="muted">SEO настроен</div> : null}
                {product.attributes.length > 0 ? <div className="muted">Характеристик: {product.attributes.length}</div> : null}
                <div className="muted">Обновлен: {product.updatedAt.toLocaleString("ru-RU")}</div>
              </div>
              <div>{product.category.name}</div>
              <div>{Number(product.price).toLocaleString("ru-RU")} ₽</div>
              <div>{product.inStock ? "В наличии" : "Под заказ"}</div>
              <div className="actions">
                <Link className="button button-primary" href={`/admin/products?edit=${encodeURIComponent(product.sku)}`}>
                  Редактировать
                </Link>
                <form action={toggleProductStockAction}>
                  <input type="hidden" name="sku" value={product.sku} />
                  <input type="hidden" name="current" value={String(product.inStock)} />
                  <button className="button button-secondary" type="submit">
                    {product.inStock ? "Снять с наличия" : "Вернуть в наличие"}
                  </button>
                </form>
                <form action={deleteProductAction}>
                  <input type="hidden" name="sku" value={product.sku} />
                  <button className="button button-secondary" type="submit">
                    Удалить
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="grid">
        {productRecords.map((product) => {
          const currentValues = new Map(
            product.attributes.map((attribute) => [attribute.definition.code, attribute.value]),
          );

          return (
            <article key={product.id} className="card glass admin-category-card">
              <div className="admin-category-header">
                <div>
                  <div className="section-label">Характеристики товара</div>
                  <h2>{product.name}</h2>
                  <p className="muted">
                    {product.category.name} • {product.sku}
                  </p>
                </div>
                <Link className="button button-secondary" href={`/admin/products?edit=${encodeURIComponent(product.sku)}`}>
                  Открыть в редакторе
                </Link>
              </div>

              {product.category.attributes.length === 0 ? (
                <p className="muted">
                  Для этой категории еще не заданы атрибуты. Сначала настройте их в разделе категорий.
                </p>
              ) : (
                <div className="grid grid-2">
                  {product.category.attributes.map((definition) => (
                    <form key={definition.id} action={updateProductAttributeAction} className="card glass admin-form-card">
                      <input type="hidden" name="sku" value={product.sku} />
                      <input type="hidden" name="code" value={definition.code} />
                      <div className="section-label">{definition.label}</div>
                      <div className="muted">Code: {definition.code}</div>
                      <label className="field">
                        <span>Значение</span>
                        <select name="value" defaultValue={currentValues.get(definition.code) ?? ""}>
                          <option value="">Не задано</option>
                          {definition.values.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="actions">
                        <button className="button button-secondary" type="submit">
                          Сохранить характеристику
                        </button>
                      </div>
                    </form>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}