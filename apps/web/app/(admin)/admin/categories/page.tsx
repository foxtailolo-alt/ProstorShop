import { loadCategoryTree } from "../../../../lib/data/catalog";
import { CategoryManager } from "./category-tree";

export default async function AdminCategoriesPage() {
  const tree = await loadCategoryTree();

  return (
    <main>
      <section className="admin-header glass">
        <h2 style={{ margin: 0 }}>Категории товаров</h2>
      </section>
      <section style={{ marginTop: 16 }}>
        <CategoryManager tree={tree} />
      </section>
    </main>
  );
}