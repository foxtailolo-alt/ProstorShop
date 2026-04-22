import Link from "next/link";
import { StoreNav } from "../../components/layout/store-nav";
import { ProductCardMedia } from "../../components/product/product-card-media";
import { BannerCarousel } from "../../components/store/banner-carousel";
import { BestsellersSection } from "../../components/store/bestsellers-section";
import { CategoryGrid } from "../../components/store/category-grid";
import { CoverflowCarousel } from "../../components/store/coverflow-carousel";
import {
  getRuntimeFeatureFlags,
  listActiveBanners,
  listCatalogCategories,
  listCatalogProducts,
  loadCategoryTree,
  loadHomepageSections,
} from "../../lib/data/catalog";
import { addToCartAction } from "./cart/actions";

export default async function StorefrontPage() {
  const [catalogCategories, products, featureFlags, banners, categoryTree, homepageSections] =
    await Promise.all([
      listCatalogCategories(),
      listCatalogProducts(),
      getRuntimeFeatureFlags(),
      listActiveBanners(),
      loadCategoryTree(),
      loadHomepageSections(),
    ]);

  const inStockProducts = products.filter((p) => p.inStock);

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

      {/* Banner Carousel */}
      {banners.length > 0 && (
        <section className="store-section animate-fade-up">
          <BannerCarousel banners={banners} />
        </section>
      )}

      {/* Dynamic homepage sections */}
      {homepageSections.map((section) => {
        if (section.type === "bestsellers") {
          return (
            <BestsellersSection
              key={section.id}
              title={section.title}
              items={section.items}
              addToCartAction={addToCartAction}
            />
          );
        }
        if (section.type === "recommendations") {
          return (
            <CoverflowCarousel
              key={section.id}
              title={section.title}
              items={section.items}
            />
          );
        }
        // custom sections — grid like featured products
        return (
          <section key={section.id} className="store-section">
            <h2 className="store-section-title animate-fade-up">{section.title}</h2>
            <div className="grid grid-4">
              {section.items.filter((i) => i.product).map((item, i) => {
                const p = item.product!;
                return (
                  <article key={item.id} className={`product-card glass animate-fade-up delay-${Math.min(i + 1, 6)}`}>
                    <Link href={`/catalog/${p.categorySlug}/${p.slug}`}>
                      <ProductCardMedia
                        images={p.imageUrls.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : []}
                        productName={p.name}
                        badge={p.badge}
                      />
                    </Link>
                    <div className="product-card-body">
                      <span className="product-card-brand">{p.brand}</span>
                      <Link href={`/catalog/${p.categorySlug}/${p.slug}`} className="product-card-name">
                        {p.name}
                      </Link>
                      <div className="product-card-price-row">
                        <span className="product-card-price">{p.price.toLocaleString("ru-RU")} ₽</span>
                        {p.compareAtPrice ? (
                          <span className="product-card-old-price">{p.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                        ) : null}
                      </div>
                      <div className="product-card-stock">
                        {p.inStock ? "✓ В наличии" : "Под заказ"}
                      </div>
                      <form action={addToCartAction} className="product-card-actions">
                        <input type="hidden" name="productSlug" value={p.slug} />
                        <input type="hidden" name="quantity" value="1" />
                        <input type="hidden" name="redirectTo" value="/" />
                        <button className="button button-primary button-sm" type="submit">В корзину</button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Category Grid */}
      {categoryTree.length > 0 && <CategoryGrid categories={categoryTree} />}

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