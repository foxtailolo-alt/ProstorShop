import Link from "next/link";
import { prisma } from "@prostor/db";
import { StoreNav } from "../../components/layout/store-nav";
import { ProductCardMedia } from "../../components/product/product-card-media";
import { BannerCarousel } from "../../components/store/banner-carousel";
import { BestsellersSection } from "../../components/store/bestsellers-section";
import { CategoryGrid } from "../../components/store/category-grid";
import { CoverflowCarousel } from "../../components/store/coverflow-carousel";
import { getSession } from "../../lib/auth/session";
import {
  getRuntimeFeatureFlags,
  listActiveBanners,
  listCatalogCategories,
  listCatalogProducts,
  loadCategoryTree,
  loadHomepageSections,
} from "../../lib/data/catalog";
import { findUsedInventoryCandidates } from "../../lib/upgrade-suggestions";
import { addToCartAction } from "./cart/actions";

async function addToCartFormAction(formData: FormData) {
  "use server";

  await addToCartAction(formData);
}

export default async function StorefrontPage() {
  const [catalogCategories, products, featureFlags, banners, categoryTree, homepageSections, session] =
    await Promise.all([
      listCatalogCategories(),
      listCatalogProducts(),
      getRuntimeFeatureFlags(),
      listActiveBanners(),
      loadCategoryTree(),
      loadHomepageSections(),
      getSession(),
    ]);

  const inStockProducts = products.filter((p) => p.inStock);
  const userDevices = session
    ? await prisma.userDevice.findMany({
        where: { userId: session.user.id },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          nickname: true,
          brand: true,
          model: true,
          categoryCode: true,
          storage: true,
          estimatedTradeInValue: true,
        },
      })
    : [];

  const usedStockBanner = userDevices
    .map((device) => {
      const candidates = findUsedInventoryCandidates(
        {
          categoryCode: device.categoryCode,
          brand: device.brand,
          model: device.model,
          storage: device.storage,
          estimatedTradeInValue: Number(device.estimatedTradeInValue),
        },
        products,
        categoryTree,
      );

      if (candidates.length === 0) {
        return null;
      }

      return {
        deviceTitle: device.nickname?.trim() || `${device.brand} ${device.model}`,
        candidates,
      };
    })
    .find(Boolean) ?? null;

  return (
    <main className="page shell">
      <StoreNav />

      {usedStockBanner ? (
        <section className="store-section animate-fade-up">
          <div className="used-stock-banner glass">
            <div className="used-stock-banner-copy">
              <div className="section-label">Ваше персональное предложение</div>
              <h2 className="store-section-title" style={{ marginBottom: 8 }}>
                Под {usedStockBanner.deviceTitle} уже есть подходящие trade-in позиции
              </h2>
              <p className="store-page-subtitle" style={{ marginBottom: 0 }}>
                В каталоге сейчас доступно {usedStockBanner.candidates.length} релевантных варианта. Можно сразу открыть профиль или перейти в карточку товара.
              </p>
            </div>
            <div className="used-stock-banner-actions">
              <Link className="button button-primary" href="/profile">Открыть профиль</Link>
              <Link
                className="button button-secondary"
                href={`/catalog/${usedStockBanner.candidates[0]?.categorySlug}/${usedStockBanner.candidates[0]?.slug}`}
              >
                Смотреть вариант
              </Link>
            </div>
          </div>
        </section>
      ) : null}

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
              addToCartAction={addToCartFormAction}
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
                      {p.hasOptions ? (
                        <div className="product-card-actions">
                          <Link className="button button-primary button-sm" href={`/catalog/${p.categorySlug}/${p.slug}?configure=1`}>
                            В корзину
                          </Link>
                        </div>
                      ) : (
                        <form action={addToCartFormAction} className="product-card-actions">
                          <input type="hidden" name="productSlug" value={p.slug} />
                          <input type="hidden" name="quantity" value="1" />
                          <input type="hidden" name="redirectTo" value="/" />
                          <button className="button button-primary button-sm" type="submit">В корзину</button>
                        </form>
                      )}
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