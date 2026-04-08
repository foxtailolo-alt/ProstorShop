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
  }>;
};

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const currentPage = Math.max(1, Number(params.page) || 1);

  const searchWhere = searchQuery
    ? {
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" as const } },
          { sku: { contains: searchQuery, mode: "insensitive" as const } },
          { brand: { contains: searchQuery, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [categories, totalCount, productRecords, allProductOptions] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, parentId: true },
    }),
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

  // Build category tree
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
        editSku={params.edit ?? null}
        upsertAction={upsertProductAction}
        toggleStockAction={toggleProductStockAction}
        deleteAction={deleteProductAction}
      />

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <AdminSearch basePath="/admin/products" query={searchQuery} placeholder="Поиск..." />
        <AdminPagination basePath="/admin/products" currentPage={currentPage} totalPages={totalPages} searchQuery={searchQuery} />
      </div>
    </main>
  );
}