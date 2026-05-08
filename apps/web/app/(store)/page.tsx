import Link from "next/link";
import { prisma } from "@prostor/db";
import { AddToCartButton } from "../../components/cart/add-to-cart-button";
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
import { buildUpgradeSuggestions } from "../../lib/upgrade-suggestions";
import { addToCartAction } from "./cart/actions";

function getDeviceTitle(device: { nickname: string | null; brand: string; model: string }) {
  return device.nickname?.trim() || `${device.brand} ${device.model}`;
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

  const devicesWithOffers = userDevices
    .map((device) => {
      const suggestions = buildUpgradeSuggestions(
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

      if (suggestions.length === 0) {
        return null;
      }

      return {
        deviceTitle: getDeviceTitle(device),
        suggestions,
      };
    })
    .filter((device): device is { deviceTitle: string; suggestions: ReturnType<typeof buildUpgradeSuggestions> } => Boolean(device));
  const firstDeviceWithOffers = devicesWithOffers[0] ?? null;
  const totalPersonalOfferCount = devicesWithOffers.reduce((sum, device) => sum + device.suggestions.length, 0);
  const personalOffersTitle = devicesWithOffers.length > 1
    ? "Для ваших устройств уже есть подходящие варианты"
    : firstDeviceWithOffers
      ? `Для ${firstDeviceWithOffers.deviceTitle} уже есть подходящие варианты`
      : null;

  return (
    <main className="page shell">
      <StoreNav />

      {devicesWithOffers.length > 0 && personalOffersTitle ? (
        <section className="store-section animate-fade-up">
          <div className="used-stock-banner glass">
            <div className="used-stock-banner-copy">
              <div className="section-label">Ваше персональное предложение</div>
              <h2 className="store-section-title" style={{ marginBottom: 8 }}>
                {personalOffersTitle}
              </h2>
              <p className="store-page-subtitle" style={{ marginBottom: 0 }}>
                В персональных предложениях уже доступно {totalPersonalOfferCount} релевантных вариантов: новые и trade-in позиции.
              </p>
            </div>
            <div className="used-stock-banner-actions">
              <Link className="button button-primary" href="/profile?tab=offers">Смотреть варианты</Link>
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
                      {p.hasOptions ? (
                        <div className="product-card-actions">
                          <Link className="button button-primary button-sm" href={`/catalog/${p.categorySlug}/${p.slug}?configure=1`}>
                            В корзину
                          </Link>
                        </div>
                      ) : (
                        <div className="product-card-actions">
                          <AddToCartButton
                            addToCartAction={addToCartAction}
                            productSlug={p.slug}
                            productName={p.name}
                            className="button button-primary button-sm"
                            label="В корзину"
                          />
                        </div>
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

    </main>
  );
}