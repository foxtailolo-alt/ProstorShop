import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreNav } from "../../../../components/layout/store-nav";
import { ProductCardMedia } from "../../../../components/product/product-card-media";
import { buildAbsoluteUrl } from "../../../../lib/seo";
import { addToCartAction } from "../../cart/actions";
import {
  listCatalogProducts,
  loadCategoryTree,
  findNodeBySlug,
  getCategoryPath,
  getAllCategorySlugs,
  type CategoryTreeNode,
} from "../../../../lib/data/catalog";

type CategoryPageProps = {
  params: Promise<{
    category: string;
  }>;
};

function countTreeProducts(node: CategoryTreeNode): number {
  return node.productCount + node.children.reduce((sum, child) => sum + countTreeProducts(child), 0);
}

export async function generateStaticParams() {
  const tree = await loadCategoryTree();
  return getAllCategorySlugs(tree).map((slug) => ({ category: slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const tree = await loadCategoryTree();
  const node = findNodeBySlug(tree, category);

  if (!node) {
    return {};
  }

  const title = node.seoTitle ?? `${node.name} | Простор`;
  const description = node.seoDescription ?? `${node.name} в магазине Простор.`;

  return {
    title,
    description,
    alternates: {
      canonical: buildAbsoluteUrl(`/catalog/${node.slug}`),
    },
    openGraph: {
      title,
      description,
      url: buildAbsoluteUrl(`/catalog/${node.slug}`),
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const tree = await loadCategoryTree();
  const node = findNodeBySlug(tree, category);

  if (!node) {
    notFound();
  }

  const ancestors = getCategoryPath(tree, category).slice(0, -1);
  const isLeaf = node.children.length === 0;

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <div className="breadcrumbs">
          <Link href="/catalog">Каталог</Link>
          {ancestors.map((anc) => (
            <span key={anc.slug}>
              <span className="breadcrumb-sep">/</span>
              <Link href={`/catalog/${anc.slug}`}>{anc.name}</Link>
            </span>
          ))}
          <span className="breadcrumb-sep">/</span>
          <span>{node.name}</span>
        </div>
        <h1 className="store-page-title">{node.name}</h1>
        {node.seoDescription && <p className="store-page-subtitle">{node.seoDescription}</p>}
      </section>

      {isLeaf ? (
        <LeafCategoryProducts categorySlug={category} />
      ) : (
        <section className="store-section">
          <div className="grid grid-4">
            {node.children.map((child, i) => {
              const totalProducts = countTreeProducts(child);
              return (
                <Link
                  key={child.slug}
                  href={`/catalog/${child.slug}`}
                  className={`category-card glass animate-fade-up delay-${Math.min(i + 1, 8)}`}
                >
                  <span className="category-card-icon">📁</span>
                  <span className="category-card-name">{child.name}</span>
                  <span className="category-card-count">
                    {child.children.length > 0
                      ? `${child.children.length} подкатегорий`
                      : `${totalProducts} товаров`}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

async function LeafCategoryProducts({ categorySlug }: { categorySlug: string }) {
  const products = await listCatalogProducts(categorySlug);

  if (products.length === 0) {
    return (
      <section className="store-section">
        <div className="empty-state glass">
          <p>В этой категории пока нет товаров</p>
          <Link className="button button-primary" href="/catalog">Вернуться в каталог</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="store-section">
      <div className="grid grid-4">
        {products.map((product, i) => (
          <article key={product.sku} className={`product-card glass animate-fade-up delay-${Math.min(i + 1, 8)}`}>
            <Link href={`/catalog/${categorySlug}/${product.slug}`}>
              <ProductCardMedia
                images={product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []}
                productName={product.name}
                badge={product.badge}
              />
            </Link>
            <div className="product-card-body">
              <span className="product-card-brand">{product.brand}</span>
              <Link href={`/catalog/${categorySlug}/${product.slug}`} className="product-card-name">
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
                <input type="hidden" name="redirectTo" value={`/catalog/${categorySlug}`} />
                <button className="button button-primary button-sm" type="submit">В корзину</button>
                <Link className="button button-secondary button-sm" href={`/catalog/${categorySlug}/${product.slug}`}>
                  Подробнее
                </Link>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}