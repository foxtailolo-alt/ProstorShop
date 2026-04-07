import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories } from "@prostor/core";
import { StoreNav } from "../../../../components/layout/store-nav";
import { ProductCardMedia } from "../../../../components/product/product-card-media";
import { buildAbsoluteUrl } from "../../../../lib/seo";
import { addToCartAction } from "../../cart/actions";
import { findCatalogCategory, listCatalogProducts } from "../../../../lib/data/catalog";

type CategoryPageProps = {
  params: Promise<{
    category: string;
  }>;
};

export function generateStaticParams() {
  return catalogCategories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const currentCategory = await findCatalogCategory(category);

  if (!currentCategory) {
    return {};
  }

  return {
    title: currentCategory.seoTitle ?? `${currentCategory.name} | Простор`,
    description: currentCategory.seoDescription ?? currentCategory.description,
    alternates: {
      canonical: buildAbsoluteUrl(`/catalog/${currentCategory.slug}`),
    },
    openGraph: {
      title: currentCategory.seoTitle ?? `${currentCategory.name} | Простор`,
      description: currentCategory.seoDescription ?? currentCategory.description,
      url: buildAbsoluteUrl(`/catalog/${currentCategory.slug}`),
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const currentCategory = await findCatalogCategory(category);

  if (!currentCategory) {
    notFound();
  }

  const products = await listCatalogProducts(category);

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <div className="breadcrumbs">
          <Link href="/catalog">Каталог</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{currentCategory.name}</span>
        </div>
        <h1 className="store-page-title">{currentCategory.name}</h1>
        <p className="store-page-subtitle">{currentCategory.description}</p>
      </section>

      <section className="store-section">
        <div className="grid grid-4">
          {products.map((product, i) => (
            <article key={product.sku} className={`product-card glass animate-fade-up delay-${Math.min(i + 1, 8)}`}>
              <Link href={`/catalog/${currentCategory.slug}/${product.slug}`}>
                <ProductCardMedia
                  images={product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []}
                  productName={product.name}
                  badge={product.badge}
                />
              </Link>
              <div className="product-card-body">
                <span className="product-card-brand">{product.brand}</span>
                <Link href={`/catalog/${currentCategory.slug}/${product.slug}`} className="product-card-name">
                  {product.name}
                </Link>
                <p className="product-card-summary">{product.summary}</p>
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
                  <input type="hidden" name="redirectTo" value={`/catalog/${currentCategory.slug}`} />
                  <button className="button button-primary button-sm" type="submit">В корзину</button>
                  <Link className="button button-secondary button-sm" href={`/catalog/${currentCategory.slug}/${product.slug}`}>
                    Подробнее
                  </Link>
                </form>
              </div>
            </article>
          ))}
        </div>
        {products.length === 0 ? (
          <div className="empty-state glass">
            <p>В этой категории пока нет товаров</p>
            <Link className="button button-primary" href="/catalog">Вернуться в каталог</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}