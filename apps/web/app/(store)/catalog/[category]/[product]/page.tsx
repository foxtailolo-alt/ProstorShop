import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogProducts } from "@prostor/core";
import { StoreNav } from "../../../../../components/layout/store-nav";
import { buildAbsoluteUrl } from "../../../../../lib/seo";
import { findCatalogCategory, findCatalogProduct } from "../../../../../lib/data/catalog";
import { addToCartAction } from "../../../cart/actions";
import { ProductGallery } from "../../../../../components/product/product-gallery";

type ProductPageProps = {
  params: Promise<{
    category: string;
    product: string;
  }>;
};

export function generateStaticParams() {
  return catalogProducts.map((product) => ({
    category: product.categorySlug,
    product: product.slug,
  }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { category, product } = await params;
  const currentProduct = await findCatalogProduct(category, product);

  if (!currentProduct) {
    return {};
  }

  return {
    title: currentProduct.seoTitle ?? `${currentProduct.name} — купить в Просторе`,
    description: currentProduct.seoDescription ?? currentProduct.summary,
    alternates: {
      canonical: buildAbsoluteUrl(`/catalog/${category}/${product}`),
    },
    openGraph: {
      title: currentProduct.seoTitle ?? `${currentProduct.name} — купить в Просторе`,
      description: currentProduct.seoDescription ?? currentProduct.summary,
      url: buildAbsoluteUrl(`/catalog/${category}/${product}`),
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { category, product } = await params;
  const [currentCategory, currentProduct] = await Promise.all([
    findCatalogCategory(category),
    findCatalogProduct(category, product),
  ]);

  if (!currentCategory || !currentProduct) {
    notFound();
  }

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
        <span className="breadcrumb-sep">/</span>
        <Link href={`/catalog/${currentCategory.slug}`}>{currentCategory.name}</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{currentProduct.name}</span>
      </div>

      <section className="product-page glass animate-scale-in">
        <div className="grid grid-2 product-hero-grid">
          <ProductGallery images={productImages} productName={currentProduct.name} />
          <div className="product-page-info">
            <span className="product-card-brand">{currentProduct.brand}</span>
            <h1 className="product-page-title">{currentProduct.name}</h1>
            <p className="product-page-summary">{currentProduct.summary}</p>

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

            <form action={addToCartAction} className="product-page-actions">
              <input type="hidden" name="productSlug" value={currentProduct.slug} />
              <input type="hidden" name="quantity" value="1" />
              <input type="hidden" name="redirectTo" value={`/catalog/${currentCategory.slug}/${currentProduct.slug}`} />
              <button className="button button-primary button-lg" type="submit">
                Добавить в корзину
              </button>
            </form>

            <div className="product-page-highlights">
              {currentProduct.highlights.map((item) => (
                <span key={item} className="product-highlight-tag">{item}</span>
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
    </main>
  );
}