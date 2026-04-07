import Link from "next/link";
import { StoreNav } from "../../../components/layout/store-nav";
import { ProductCardMedia } from "../../../components/product/product-card-media";
import { listCatalogCategories, listCatalogProducts } from "../../../lib/data/catalog";
import { addToCartAction } from "../cart/actions";

const categoryIcons: Record<string, string> = {
  iphone: "📱",
  samsung: "📲",
  macbook: "💻",
  ipad: "📋",
  accessories: "🎧",
};

export default async function CatalogPage() {
  const [catalogCategories, products] = await Promise.all([
    listCatalogCategories(),
    listCatalogProducts(),
  ]);

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Каталог</h1>
        <div className="grid grid-5">
          {catalogCategories.map((category, i) => {
            const count = products.filter((item) => item.categorySlug === category.slug).length;
            return (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className={`category-card glass animate-fade-up delay-${i + 1}`}
              >
                <span className="category-card-icon">{categoryIcons[category.slug] ?? "📦"}</span>
                <span className="category-card-name">{category.name}</span>
                <span className="category-card-count">{count} товаров</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="store-section">
        <h2 className="store-section-title animate-fade-up">Все товары</h2>
        <div className="grid grid-4">
          {products.map((product, i) => (
            <article key={product.sku} className={`product-card glass animate-fade-up delay-${Math.min(i + 1, 8)}`}>
              <Link href={`/catalog/${product.categorySlug}/${product.slug}`}>
                <ProductCardMedia
                  images={product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []}
                  productName={product.name}
                  badge={product.badge}
                />
              </Link>
              <div className="product-card-body">
                <span className="product-card-brand">{product.brand}</span>
                <Link href={`/catalog/${product.categorySlug}/${product.slug}`} className="product-card-name">
                  {product.name}
                </Link>
                <div className="product-card-price-row">
                  <span className="product-card-price">{product.price.toLocaleString("ru-RU")} ₽</span>
                  {product.compareAtPrice ? (
                    <span className="product-card-old-price">{product.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                  ) : null}
                </div>
                <div className="product-card-stock">
                  {product.inStock ? "✓ В наличии" : "Под заказ"}
                </div>
                <form action={addToCartAction} className="product-card-actions">
                  <input type="hidden" name="productSlug" value={product.slug} />
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="redirectTo" value="/catalog" />
                  <button className="button button-primary button-sm" type="submit">В корзину</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}