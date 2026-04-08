import Link from "next/link";
import { StoreNav } from "../../components/layout/store-nav";
import { ProductCardMedia } from "../../components/product/product-card-media";
import { BannerCarousel } from "../../components/store/banner-carousel";
import { getRuntimeFeatureFlags, listActiveBanners, listCatalogCategories, listCatalogProducts } from "../../lib/data/catalog";
import { addToCartAction } from "./cart/actions";

const secondaryCategories = [
  { slug: "macbook", icon: "💻", name: "MacBook" },
  { slug: "ipad", icon: "📋", name: "iPad" },
  { slug: "accessories", icon: "🎧", name: "Аксессуары" },
];

export default async function StorefrontPage() {
  const [catalogCategories, products, featureFlags, banners] = await Promise.all([
    listCatalogCategories(),
    listCatalogProducts(),
    getRuntimeFeatureFlags(),
    listActiveBanners(),
  ]);

  const inStockProducts = products.filter((p) => p.inStock);
  const featuredProducts = products.filter((p) => p.featured);

  const countByCategory = (slug: string) => products.filter((p) => p.categorySlug === slug).length;

  const appleCategories = ["iphone", "macbook", "ipad"];
  const appleCount = appleCategories.reduce((sum, slug) => sum + countByCategory(slug), 0);
  const samsungCount = countByCategory("samsung");

  return (
    <main className="page shell">
      <StoreNav />

      {/* Hero */}
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

      {/* Apple & Samsung Hero Blocks */}
      <section className="store-section">
        <div className="grid grid-2">
          <Link href="/catalog/iphone" className="brand-hero-card brand-hero-apple glass animate-fade-up delay-1">
            <div className="brand-hero-content">
              <span className="brand-hero-icon">🍎</span>
              <h2 className="brand-hero-title">Apple</h2>
              <p className="brand-hero-text">iPhone, MacBook, iPad</p>
              <span className="brand-hero-count">{appleCount} товаров</span>
            </div>
            <span className="brand-hero-arrow">→</span>
          </Link>
          <Link href="/catalog/samsung" className="brand-hero-card brand-hero-samsung glass animate-fade-up delay-2">
            <div className="brand-hero-content">
              <span className="brand-hero-icon">📱</span>
              <h2 className="brand-hero-title">Samsung</h2>
              <p className="brand-hero-text">Galaxy S, Z Fold, Z Flip</p>
              <span className="brand-hero-count">{samsungCount} товаров</span>
            </div>
            <span className="brand-hero-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* Secondary Categories */}
      <section className="store-section">
        <div className="grid grid-3">
          {secondaryCategories.map((cat, i) => {
            const count = countByCategory(cat.slug);
            return (
              <Link
                key={cat.slug}
                href={`/catalog/${cat.slug}`}
                className={`category-card glass animate-fade-up delay-${i + 1}`}
              >
                <span className="category-card-icon">{cat.icon}</span>
                <span className="category-card-name">{cat.name}</span>
                <span className="category-card-count">{count} товаров</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Banner Carousel */}
      {banners.length > 0 && (
        <section className="store-section animate-fade-up">
          <BannerCarousel banners={banners} />
        </section>
      )}

      {/* Featured Products */}
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

      {/* Trade-in & Service blocks */}
      {(featureFlags.tradeInEnabled || featureFlags.serviceEnabled) && (
        <section className="store-section">
          <div className="grid grid-2">
            {featureFlags.tradeInEnabled && (
              <div className="service-promo-card glass animate-fade-up delay-1">
                <div className="service-promo-icon-wrap service-promo-tradein">
                  <span className="service-promo-icon">💰</span>
                </div>
                <h3 className="service-promo-title">Trade-in</h3>
                <p className="service-promo-text">
                  Сдайте старое устройство и получите скидку на новую покупку.
                  Оценка онлайн за 30 секунд.
                </p>
                <Link className="button button-primary button-sm" href="/trade-in">
                  Оценить устройство
                </Link>
              </div>
            )}
            {featureFlags.serviceEnabled && (
              <div className="service-promo-card glass animate-fade-up delay-2">
                <div className="service-promo-icon-wrap service-promo-repair">
                  <span className="service-promo-icon">🔧</span>
                </div>
                <h3 className="service-promo-title">Сервис</h3>
                <p className="service-promo-text">
                  Быстрый ремонт Apple и Samsung с прозрачными ценами.
                  Узнайте стоимость онлайн.
                </p>
                <Link className="button button-primary button-sm" href="/service">
                  Рассчитать ремонт
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Advantages */}
      <section className="store-section">
        <div className="grid grid-4">
          {[
            { icon: "🚀", title: "Быстрая доставка", text: "По Москве за 2 часа, по России от 1 дня" },
            { icon: "🛡️", title: "Гарантия", text: "Официальная гарантия на всю технику" },
            { icon: "💰", title: "Trade-in", text: "Сдайте старое устройство и получите скидку" },
            { icon: "🔧", title: "Сервис", text: "Ремонт любой сложности с прозрачными ценами" },
          ].map((item, i) => (
            <div key={item.title} className={`advantage-card glass animate-fade-up delay-${i + 1}`}>
              <span className="advantage-icon">{item.icon}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}