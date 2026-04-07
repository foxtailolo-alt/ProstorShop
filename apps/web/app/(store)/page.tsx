import Link from "next/link";
import { StoreNav } from "../../components/layout/store-nav";
import { ProductCardMedia } from "../../components/product/product-card-media";
import { getRuntimeFeatureFlags, listCatalogCategories, listCatalogProducts } from "../../lib/data/catalog";
import { addToCartAction } from "./cart/actions";

const categoryIcons: Record<string, string> = {
  iphone: "📱",
  samsung: "📲",
  macbook: "💻",
  ipad: "📋",
  accessories: "🎧",
};

const advantages = [
  { icon: "🚀", title: "Быстрая доставка", text: "По Москве за 2 часа, по России от 1 дня" },
  { icon: "🛡️", title: "Гарантия", text: "Официальная гарантия на всю технику" },
  { icon: "💰", title: "Trade-in", text: "Сдайте старое устройство и получите скидку" },
  { icon: "🔧", title: "Сервис", text: "Ремонт любой сложности с прозрачными ценами" },
];

export default async function StorefrontPage() {
  const [catalogCategories, products, featureFlags] = await Promise.all([
    listCatalogCategories(),
    listCatalogProducts(),
    getRuntimeFeatureFlags(),
  ]);

  const featuredProducts = products.filter((p) => p.featured);
  const inStockProducts = products.filter((p) => p.inStock);

  return (
    <main className="page shell">
      <StoreNav />

      <section className="hero glass">
        <div className="grid grid-2 product-hero-grid">
          <div className="animate-fade-up">
            <h1>Магазин техники<br />Простор</h1>
            <p className="hero-subtitle">
              iPhone, Samsung, MacBook, iPad и аксессуары.<br />
              Честные цены, гарантия, trade-in и сервис.
            </p>
            <div className="actions" style={{ marginTop: 24 }}>
              <Link className="button button-primary" href="/catalog">
                Перейти в каталог
              </Link>
              {featureFlags.tradeInEnabled ? (
                <Link className="button button-secondary" href="/trade-in">
                  Оценить Trade-in
                </Link>
              ) : null}
            </div>
          </div>
          <div className="hero-stats animate-fade-up delay-2">
            <div className="hero-stat-item">
              <span className="hero-stat-number">{inStockProducts.length}</span>
              <span className="hero-stat-label">товаров в наличии</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-number">{catalogCategories.length}</span>
              <span className="hero-stat-label">категорий</span>
            </div>
          </div>
        </div>
      </section>

      <section className="store-section">
        <h2 className="store-section-title animate-fade-up">Категории</h2>
        <div className="grid grid-5">
          {catalogCategories.map((category, i) => {
            const count = products.filter((p) => p.categorySlug === category.slug).length;
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

      {featuredProducts.length > 0 ? (
        <section className="store-section">
          <h2 className="store-section-title animate-fade-up">Популярные товары</h2>
          <div className="grid grid-4">
            {featuredProducts.map((product, i) => (
              <article key={product.sku} className={`product-card glass animate-fade-up delay-${i + 1}`}>
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
                    <input type="hidden" name="redirectTo" value="/" />
                    <button className="button button-primary button-sm" type="submit">В корзину</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="store-section">
        <div className="grid grid-4">
          {advantages.map((item, i) => (
            <div key={item.title} className={`advantage-card glass animate-fade-up delay-${i + 1}`}>
              <span className="advantage-icon">{item.icon}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {featureFlags.tradeInEnabled ? (
        <section className="store-section">
          <div className="promo-banner glass animate-fade-up">
            <div>
              <h2>Trade-in: сдайте старое — получите скидку</h2>
              <p>Оцените ваше устройство онлайн за 30 секунд и узнайте, сколько можно сэкономить на новой покупке.</p>
            </div>
            <Link className="button button-primary" href="/trade-in">
              Оценить устройство
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}