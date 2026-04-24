import { prisma } from "@prostor/db";
import { AdminPagination, AdminSearch, PAGE_SIZE } from "../../../../components/admin/admin-pagination";
import {
  deleteProductAction,
  toggleProductStockAction,
  upsertProductAction,
} from "./actions";
import { ProductsGrid } from "./products-grid";

type AdminProductsPageProps = {
  searchParams: Promise<{
    edit?: string;
    q?: string;
    page?: string;
    saved?: string;
    category?: string;
    status?: string;
  }>;
};

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const selectedCategorySlug = params.category?.trim() ?? "";
  const selectedStatus = params.status?.trim() ?? "all";
  const currentPage = Math.max(1, Number(params.page) || 1);

  const categories = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });

  type CatNode = { id: string; name: string; slug: string; parentId: string | null; children: CatNode[] };
  const nodeMap = new Map<string, CatNode>();
  for (const c of categories) {
    nodeMap.set(c.id, { ...c, children: [] });
  }
  const rootCategories: CatNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      rootCategories.push(node);
    }
  }

  const slugToNode = new Map<string, CatNode>();
  const categoryFilterOptions: Array<{ slug: string; label: string }> = [];

  function collectCategoryMeta(nodes: CatNode[], parentTrail: string[] = []) {
    for (const node of nodes) {
      slugToNode.set(node.slug, node);
      const trail = [...parentTrail, node.name];
      categoryFilterOptions.push({ slug: node.slug, label: trail.join(" / ") });
      if (node.children.length > 0) {
        collectCategoryMeta(node.children, trail);
      }
    }
  }

  collectCategoryMeta(rootCategories);

  function collectDescendantSlugs(node: CatNode): string[] {
    return [node.slug, ...node.children.flatMap((child) => collectDescendantSlugs(child))];
  }

  const categorySlugs = selectedCategorySlug && slugToNode.has(selectedCategorySlug)
    ? collectDescendantSlugs(slugToNode.get(selectedCategorySlug)!)
    : null;

  const searchConditions = [] as object[];

  if (searchQuery) {
    searchConditions.push({
      OR: [
        { name: { contains: searchQuery, mode: "insensitive" as const } },
        { sku: { contains: searchQuery, mode: "insensitive" as const } },
        { brand: { contains: searchQuery, mode: "insensitive" as const } },
      ],
    });
  }

  if (categorySlugs && categorySlugs.length > 0) {
    searchConditions.push({ category: { slug: { in: categorySlugs } } });
  }

  if (selectedStatus === "in-stock") {
    searchConditions.push({ inStock: true });
  } else if (selectedStatus === "out-of-stock") {
    searchConditions.push({ inStock: false });
  } else if (selectedStatus === "with-photo") {
    searchConditions.push({ OR: [{ imageUrl: { not: null } }, { imageUrls: { isEmpty: false } }] });
  } else if (selectedStatus === "without-photo") {
    searchConditions.push({ AND: [{ imageUrl: null }, { imageUrls: { isEmpty: true } }] });
  }

  const searchWhere = searchConditions.length > 0 ? { AND: searchConditions } : {};

  const [totalCount, productRecords, allProductOptions] = await Promise.all([
    prisma.product.count({ where: searchWhere }),
    prisma.product.findMany({
      where: searchWhere,
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { slug: true, name: true } },
        recommendations: {
          select: { recommendedProductId: true },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, imageUrl: true, price: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const categoryPathMap = new Map(categoryFilterOptions.map((option) => [option.slug, option.label]));

  const products = productRecords.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    price: Number(p.price),
    description: p.description,
    inStock: p.inStock,
    imageUrl: p.imageUrl,
    imageUrls: p.imageUrls ?? [],
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    specs: (p.specs as Record<string, string> | null) ?? {},
    options: p.options as import("./product-options-editor").ProductOptionsData,
    category: p.category,
    categoryPath: categoryPathMap.get(p.category.slug) ?? p.category.name,
    recommendedIds: p.recommendations.map((r) => r.recommendedProductId),
  }));

  const productOptions = allProductOptions.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    imageUrl: p.imageUrl,
    price: Number(p.price),
  }));

  return (
    <main>
      <ProductsGrid
        products={products}
        categories={rootCategories}
        allProductOptions={productOptions}
        categoryFilterOptions={categoryFilterOptions}
        totalCount={totalCount}
        searchQuery={searchQuery}
        selectedCategorySlug={selectedCategorySlug}
        selectedStatus={selectedStatus}
        editSku={params.edit ?? null}
        saveMessage={params.saved ? `Товар ${params.saved} сохранен.` : null}
        upsertAction={upsertProductAction}
        toggleStockAction={toggleProductStockAction}
        deleteAction={deleteProductAction}
      />

      <div style={{ marginTop: 18 }}>
        <AdminPagination
          basePath="/admin/products"
          currentPage={currentPage}
          totalPages={totalPages}
          searchQuery={searchQuery}
          extraParams={{
            category: selectedCategorySlug || undefined,
            status: selectedStatus !== "all" ? selectedStatus : undefined,
          }}
        />
      </div>
    </main>
  );
}