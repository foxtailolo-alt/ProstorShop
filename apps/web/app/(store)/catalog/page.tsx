import Link from "next/link";
import { StoreNav } from "../../../components/layout/store-nav";
import { loadCategoryTree, type CategoryTreeNode } from "../../../lib/data/catalog";

function countTreeProducts(node: CategoryTreeNode): number {
  return node.productCount + node.children.reduce((sum, child) => sum + countTreeProducts(child), 0);
}

export default async function CatalogPage() {
  const tree = await loadCategoryTree();

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Каталог</h1>
        <div className="grid grid-5">
          {tree.map((category, i) => {
            const totalProducts = countTreeProducts(category);
            return (
              <Link
                key={category.slug}
                href={`/catalog/${category.slug}`}
                className={`category-card glass animate-fade-up delay-${i + 1}`}
              >
                <span className="category-card-icon">📦</span>
                <span className="category-card-name">{category.name}</span>
                <span className="category-card-count">
                  {category.children.length > 0
                    ? `${category.children.length} подкатегорий`
                    : `${totalProducts} товаров`}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}