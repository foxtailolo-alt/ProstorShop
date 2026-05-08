import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { catalogProducts } from "@prostor/core";
import { StoreNav } from "../../../../../components/layout/store-nav";
import { buildAbsoluteUrl } from "../../../../../lib/seo";
import { findCatalogProduct, findCatalogProductBySlug, findNodeBySlug, getProductRecommendations, getProductOptions, loadCategoryTree, getCategoryPath } from "../../../../../lib/data/catalog";
import { addToCartAction } from "../../../cart/actions";
import { AddToCartButton } from "../../../../../components/cart/add-to-cart-button";
import { ProductDescription } from "../../../../../components/product/product-description";
import { ProductGallery } from "../../../../../components/product/product-gallery";
import { ProductInfoWithOptions } from "../../../../../components/product/product-info-options";
import { isAccessoryProduct, resolveAccessoryBundlePricing } from "../../../../../lib/cart-pricing";

type ProductPageProps = {
  params: Promise<{
    category: string;
    product: string;
  }>;
  searchParams?: Promise<{
    configure?: string;
  }>;
};

export const dynamic = "force-dynamic";

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function generateStaticParams() {
  return catalogProducts.map((product) => ({
    category: product.categorySlug,
    product: product.slug,
  }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const rawParams = await params;
  const category = decodeRouteParam(rawParams.category);
  const product = decodeRouteParam(rawParams.product);
  const currentProduct = await findCatalogProduct(category, product) ?? await findCatalogProductBySlug(product);

  if (!currentProduct) {
    return {};
  }

  const canonicalCategory = currentProduct.categorySlug;
  const canonicalProduct = currentProduct.slug;

  return {
    title: currentProduct.seoTitle ?? `${currentProduct.name} — купить в Просторе`,
    description: currentProduct.seoDescription ?? currentProduct.summary,
    alternates: {
      canonical: buildAbsoluteUrl(`/catalog/${canonicalCategory}/${canonicalProduct}`),
    },
    openGraph: {
      title: currentProduct.seoTitle ?? `${currentProduct.name} — купить в Просторе`,
      description: currentProduct.seoDescription ?? currentProduct.summary,
      url: buildAbsoluteUrl(`/catalog/${canonicalCategory}/${canonicalProduct}`),
      type: "website",
    },
  };
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const rawParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const category = decodeRouteParam(rawParams.category);
  const product = decodeRouteParam(rawParams.product);
  const configurePrompt = resolvedSearchParams?.configure === "1";
  const [categoryMatchedProduct, productBySlug] = await Promise.all([
    findCatalogProduct(category, product),
    findCatalogProductBySlug(product),
  ]);

  const currentProduct = categoryMatchedProduct ?? productBySlug;

  if (currentProduct && currentProduct.categorySlug !== category) {
    redirect(`/catalog/${currentProduct.categorySlug}/${currentProduct.slug}${configurePrompt ? "?configure=1" : ""}`);
  }

  if (!currentProduct) {
    notFound();
  }

  const [recommendations, productOptions, tree] = await Promise.all([
    getProductRecommendations(currentProduct.slug),
    getProductOptions(currentProduct.slug),
    loadCategoryTree(),
  ]);

  const categoryPath = getCategoryPath(tree, currentProduct.categorySlug).slice(-3);
  const categoryNode = findNodeBySlug(tree, currentProduct.categorySlug);
  const resolvedCategory = categoryNode
    ? { slug: categoryNode.slug, name: categoryNode.name }
    : {
        slug: currentProduct.categorySlug,
        name: currentProduct.highlights[1] ?? currentProduct.categorySlug,
      };
  const ancestors = categoryPath.slice(0, -1);

  const productImages = currentProduct.imageUrls?.length
    ? currentProduct.imageUrls
    : currentProduct.imageUrl
      ? [currentProduct.imageUrl]
      : [];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: currentProduct.name,
    description: currentProduct.seoDescription ?? currentProduct.summary,
    sku: currentProduct.sku,
    brand: {
      "@type": "Brand",
      name: currentProduct.brand,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "RUB",
      price: currentProduct.price,
      availability: currentProduct.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: buildAbsoluteUrl(`/catalog/${category}/${product}`),
    },
  };

  return (
    <main className="page shell">
      <StoreNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <div className="breadcrumbs">
        <Link href="/catalog">Каталог</Link>
        {ancestors.map((anc) => (
          <span key={anc.slug}>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/catalog/${anc.slug}`}>{anc.name}</Link>
          </span>
        ))}
        <span className="breadcrumb-sep">/</span>
        <Link href={`/catalog/${resolvedCategory.slug}`}>{resolvedCategory.name}</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{currentProduct.name}</span>
      </div>

      {configurePrompt && productOptions?.groups?.length ? (
        <section className="store-section">
          <div className="added-notice glass">
            <span>Выберите конфигурацию перед добавлением в корзину</span>
          </div>
        </section>
      ) : null}

      <section className="product-page glass animate-scale-in" data-cart-source-root>
        <div className="grid grid-2 product-hero-grid">
          <ProductGallery images={productImages} productName={currentProduct.name} />
          <div className="product-page-info">
            <span className="product-card-brand">{currentProduct.brand}</span>
            <h1 className="product-page-title">{currentProduct.name}</h1>
            <ProductDescription text={currentProduct.summary} />

            {productOptions?.groups?.length ? (
              <ProductInfoWithOptions
                options={productOptions}
                basePrice={currentProduct.price}
                compareAtPrice={currentProduct.compareAtPrice}
                discountType={currentProduct.discountType}
                discountValue={currentProduct.discountValue}
                discountEndsAt={currentProduct.discountEndsAt}
                badge={currentProduct.badge}
                inStock={currentProduct.inStock}
                productName={currentProduct.name}
                slug={currentProduct.slug}
                categorySlug={resolvedCategory.slug}
                addToCartAction={addToCartAction}
              />
            ) : (
              <>
                <div className="product-page-price-block">
                  <span className="product-page-price">{currentProduct.price.toLocaleString("ru-RU")} ₽</span>
                  {currentProduct.compareAtPrice ? (
                    <span className="product-card-old-price">{currentProduct.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                  ) : null}
                  {currentProduct.badge ? <span className="product-card-badge-inline">{currentProduct.badge}</span> : null}
                </div>

                <div className="product-page-stock">
                  {currentProduct.inStock ? "✓ В наличии" : "Под заказ"}
                </div>

                <div className="product-page-actions">
                  <AddToCartButton
                    addToCartAction={addToCartAction}
                    productSlug={currentProduct.slug}
                    productName={currentProduct.name}
                    className="button button-primary button-lg"
                    label="Добавить в корзину"
                    pendingLabel="Добавляем в корзину..."
                  />
                </div>
              </>
            )}

            <div className="product-page-highlights">
              {currentProduct.highlights.map((item, index) => (
                <span key={`${item}-${index}`} className="product-highlight-tag">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="store-section">
        <h2 className="store-section-title">Характеристики</h2>
        <div className="specs-table glass">
          {Object.entries(currentProduct.specs).map(([label, value]) => (
            <div key={label} className="specs-row">
              <span className="specs-label">{label}</span>
              <span className="specs-value">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="store-section">
          <h2 className="store-section-title">Рекомендуемые товары</h2>
          <div className="grid grid-4">
            {recommendations.map((rec) => {
              const recImage = rec.imageUrls?.[0] ?? rec.imageUrl;
              const accessoryBundlePricing = isAccessoryProduct(rec)
                ? resolveAccessoryBundlePricing(rec.price)
                : null;

              return (
                <article
                  key={rec.sku}
                  className="product-card glass"
                  data-cart-source-root
                >
                  <Link href={`/catalog/${rec.categorySlug}/${rec.slug}`}>
                    {recImage ? (
                      <div className="product-card-media">
                        <img src={recImage} alt={rec.name} className="product-card-image" loading="lazy" />
                      </div>
                    ) : (
                      <div className="product-card-media product-card-media-empty" />
                    )}
                  </Link>
                  <div className="product-card-body">
                    <span className="product-card-brand">{rec.brand}</span>
                    <Link href={`/catalog/${rec.categorySlug}/${rec.slug}`} className="product-card-name">{rec.name}</Link>
                    <div className="product-card-price-stack">
                      <div className="product-card-price-row">
                        <span className="product-card-price">
                          {(accessoryBundlePricing?.discountedPrice ?? rec.price).toLocaleString("ru-RU")} ₽
                        </span>
                        {accessoryBundlePricing ? (
                          <>
                            <span className="product-card-old-price">{accessoryBundlePricing.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                            <span className="product-card-discount-pill">-{accessoryBundlePricing.discountPercent}%</span>
                          </>
                        ) : rec.compareAtPrice ? (
                          <span className="product-card-old-price">{rec.compareAtPrice.toLocaleString("ru-RU")} ₽</span>
                        ) : null}
                      </div>
                      {accessoryBundlePricing ? <span className="product-card-bundle-note">Цена с устройством</span> : null}
                    </div>
                    {rec.hasOptions ? (
                      <div className="product-card-actions">
                        <Link className="button button-primary button-sm" href={`/catalog/${rec.categorySlug}/${rec.slug}?configure=1`}>
                          Выбрать конфигурацию
                        </Link>
                      </div>
                    ) : (
                      <div className="product-card-actions">
                        <AddToCartButton
                          addToCartAction={addToCartAction}
                          productSlug={rec.slug}
                          productName={rec.name}
                          className="button button-primary button-sm"
                          label="Добавить в корзину"
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}