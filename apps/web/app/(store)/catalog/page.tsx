import { StoreNav } from "../../../components/layout/store-nav";
import { CatalogInventorySwitcher } from "../../../components/store/catalog-inventory-switcher";
import { loadCategoryTree } from "../../../lib/data/catalog";

export default async function CatalogPage() {
  const tree = await loadCategoryTree();

  return (
    <main className="page shell">
      <StoreNav />

      <section className="store-section animate-fade-up">
        <h1 className="store-page-title">Каталог</h1>
        <CatalogInventorySwitcher tree={tree} />
      </section>
    </main>
  );
}