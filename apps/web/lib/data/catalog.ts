import {
  catalogCategories,
  catalogProducts,
  defaultFeatureFlags,
  getCategoryBySlug,
  getCatalogSummary,
  getProductBySlug,
  getProductsByCategory,
  type CatalogCategory,
  type CatalogProduct,
  type FeatureFlags,
  type FilterDefinition,
} from "@prostor/core";
import { prisma } from "@prostor/db";

type DbCategoryRecord = Awaited<ReturnType<typeof loadDbCategories>>[number];
type DbProductRecord = Awaited<ReturnType<typeof loadDbProducts>>[number];

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function safeQuery<T>(query: () => Promise<T>) {
  if (!databaseConfigured()) {
    return null;
  }

  try {
    return await query();
  } catch {
    return null;
  }
}

async function loadDbCategories() {
  return prisma.category.findMany({
    include: {
      filterSets: true,
      products: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

async function loadDbProducts() {
  return prisma.product.findMany({
    include: {
      category: true,
      attributes: {
        include: {
          definition: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

async function loadDbFeatureFlags() {
  return prisma.featureFlag.findMany({
    orderBy: {
      key: "asc",
    },
  });
}

function mapDbCategory(record: DbCategoryRecord): CatalogCategory {
  const seedCategory = getCategoryBySlug(record.slug);
  const activeFilterSet = record.filterSets.find((item) => item.isActive);
  const filters = Array.isArray(activeFilterSet?.config)
    ? (activeFilterSet?.config as FilterDefinition[])
    : (seedCategory?.filters ?? []);

  return {
    slug: record.slug,
    name: record.name,
    description: seedCategory?.description ?? `${record.name} в магазине Простор.`,
    hero: seedCategory?.hero ?? `Подбор ${record.name} из единого каталога.`,
    seoTitle: record.seoTitle ?? seedCategory?.seoTitle,
    seoDescription: record.seoDescription ?? seedCategory?.seoDescription,
    filters,
  };
}

function mapDbProduct(record: DbProductRecord): CatalogProduct {
  const seedProduct = catalogProducts.find(
    (item) => item.sku === record.sku || item.slug === record.slug,
  );
  const imageUrls = record.imageUrls.length > 0
    ? record.imageUrls
    : [record.imageUrl, ...(seedProduct?.imageUrls ?? []), seedProduct?.imageUrl]
        .filter((value): value is string => Boolean(value));
  const primaryImageUrl = imageUrls[0] ?? record.imageUrl ?? seedProduct?.imageUrl;

  const specs =
    record.specs && typeof record.specs === "object" && !Array.isArray(record.specs) && Object.keys(record.specs).length > 0
      ? (record.specs as Record<string, string>)
      : record.attributes.length > 0
        ? Object.fromEntries(record.attributes.map((item) => [item.definition.label, item.value]))
        : (seedProduct?.specs ?? {});

  const attributes =
    record.attributes.length > 0
      ? Object.fromEntries(record.attributes.map((item) => [item.definition.code, item.value]))
      : (seedProduct?.attributes ?? {});

  const highlights =
    record.attributes.length > 0
      ? record.attributes.slice(0, 3).map((item) => `${item.definition.label}: ${item.value}`)
      : (seedProduct?.highlights ?? [record.brand, record.category.name, record.inStock ? "В наличии" : "Под заказ"]);

  return {
    sku: record.sku,
    slug: record.slug,
    categorySlug: record.category.slug,
    name: record.name,
    brand: record.brand,
    imageUrl: primaryImageUrl,
    imageUrls,
    seoTitle: record.seoTitle ?? seedProduct?.seoTitle,
    seoDescription: record.seoDescription ?? seedProduct?.seoDescription,
    price: Number(record.price),
    compareAtPrice: seedProduct?.compareAtPrice,
    badge: seedProduct?.badge,
    summary: record.description ?? seedProduct?.summary ?? `${record.name} в магазине Простор.`,
    highlights,
    specs,
    attributes,
    inStock: record.inStock,
    featured: seedProduct?.featured ?? false,
  };
}

export async function listCatalogCategories() {
  const dbCategories = await safeQuery(loadDbCategories);

  if (!dbCategories) {
    return catalogCategories;
  }

  return dbCategories.map(mapDbCategory);
}

export async function listCatalogProducts(categorySlug?: string) {
  const dbProducts = await safeQuery(loadDbProducts);

  if (!dbProducts) {
    return categorySlug ? getProductsByCategory(categorySlug) : catalogProducts;
  }

  const mappedProducts = dbProducts.map(mapDbProduct);

  return categorySlug
    ? mappedProducts.filter((product) => product.categorySlug === categorySlug)
    : mappedProducts;
}

export async function findCatalogCategory(categorySlug: string) {
  const categories = await listCatalogCategories();
  return categories.find((category) => category.slug === categorySlug) ?? null;
}

export async function findCatalogProduct(categorySlug: string, productSlug: string) {
  const products = await listCatalogProducts(categorySlug);
  return (
    products.find((product) => product.categorySlug === categorySlug && product.slug === productSlug) ??
    getProductBySlug(categorySlug, productSlug) ??
    null
  );
}

export async function findCatalogProductBySlug(productSlug: string) {
  const products = await listCatalogProducts();
  return products.find((product) => product.slug === productSlug) ?? null;
}

export async function getProductRecommendations(productSlug: string) {
  if (!databaseConfigured()) return [];
  const product = await safeQuery(() =>
    prisma.product.findUnique({
      where: { slug: productSlug },
      select: {
        recommendations: {
          orderBy: { position: "asc" },
          select: {
            recommendedProduct: {
              include: { category: true, attributes: { include: { definition: true } } },
            },
          },
        },
      },
    }),
  );
  if (!product || product.recommendations.length === 0) return [];
  return product.recommendations.map((r) => mapDbProduct(r.recommendedProduct));
}

type ProductOptionsData = {
  groups: { name: string; values: string[] }[];
  allVariants: boolean;
  variants?: { name: string; price: number }[];
  prices?: Record<string, Record<string, number>>;
};

export async function getProductOptions(productSlug: string): Promise<ProductOptionsData | null> {
  if (!databaseConfigured()) return null;
  const product = await safeQuery(() =>
    prisma.product.findUnique({ where: { slug: productSlug }, select: { options: true } }),
  );
  if (!product?.options || typeof product.options !== "object") return null;
  const opts = product.options as Record<string, unknown>;
  if (!Array.isArray(opts.groups) || opts.groups.length === 0) return null;
  return product.options as ProductOptionsData;
}

export async function getCatalogSummaryData() {
  const [categories, products] = await Promise.all([listCatalogCategories(), listCatalogProducts()]);

  if (categories === catalogCategories && products === catalogProducts) {
    return getCatalogSummary();
  }

  return {
    categories: categories.length,
    products: products.length,
    productsInStock: products.filter((product) => product.inStock).length,
    featuredProducts: products.filter((product) => product.featured).length,
  };
}

export async function getFeatureFlagEntries() {
  const dbFlags = await safeQuery(loadDbFeatureFlags);
  const defaultEntries = Object.entries(defaultFeatureFlags) as Array<[
    keyof FeatureFlags,
    boolean,
  ]>;

  if (!dbFlags) {
    return defaultEntries.map(([key, enabled]) => ({ key, enabled }));
  }

  return defaultEntries.map(([key, enabled]) => ({
    key,
    enabled: dbFlags.find((item) => item.key === key)?.enabled ?? enabled,
  }));
}

export async function getRuntimeFeatureFlags(): Promise<FeatureFlags> {
  const entries = await getFeatureFlagEntries();

  return entries.reduce<FeatureFlags>(
    (accumulator, entry) => ({
      ...accumulator,
      [entry.key]: entry.enabled,
    }),
    { ...defaultFeatureFlags },
  );
}

export async function listActiveBanners(categorySlug?: string) {
  const dbBanners = await safeQuery(() =>
    prisma.banner.findMany({
      where: categorySlug
        ? {
            isActive: true,
            categorySlug,
          }
        : {
            isActive: true,
            categorySlug: null,
          },
      orderBy: { sortOrder: "asc" },
      take: 5,
    }),
  );

  return dbBanners ?? [];
}

// --- Category Tree Helpers ---

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  productCount: number;
  childCount: number;
  children: CategoryTreeNode[];
};

export async function loadCategoryTree(): Promise<CategoryTreeNode[]> {
  const flat = await safeQuery(() =>
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true, children: true } } },
    }),
  );

  if (!flat) return [];

  const nodeMap = new Map<string, CategoryTreeNode>();
  for (const cat of flat) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      imageUrl: cat.imageUrl,
      parentId: cat.parentId,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
      seoKeywords: cat.seoKeywords ?? [],
      productCount: cat._count.products,
      childCount: cat._count.children,
      children: [],
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function findNodeInTree(tree: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeInTree(node.children, id);
    if (found) return found;
  }
  return null;
}

export function findNodeBySlug(tree: CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findNodeBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

export function getCategoryPath(tree: CategoryTreeNode[], targetSlug: string): CategoryTreeNode[] {
  function walk(nodes: CategoryTreeNode[], path: CategoryTreeNode[]): CategoryTreeNode[] | null {
    for (const node of nodes) {
      const current = [...path, node];
      if (node.slug === targetSlug) return current;
      const found = walk(node.children, current);
      if (found) return found;
    }
    return null;
  }
  return walk(tree, []) ?? [];
}

export function getAllCategorySlugs(tree: CategoryTreeNode[]): string[] {
  const slugs: string[] = [];
  function walk(nodes: CategoryTreeNode[]) {
    for (const node of nodes) {
      slugs.push(node.slug);
      walk(node.children);
    }
  }
  walk(tree);
  return slugs;
}

export function buildFlatCategoryOptions(
  tree: CategoryTreeNode[],
  excludeIds?: Set<string>,
): { id: string; slug: string; label: string; isLeaf: boolean }[] {
  const options: { id: string; slug: string; label: string; isLeaf: boolean }[] = [];
  function walk(nodes: CategoryTreeNode[], prefix: string) {
    for (const node of nodes) {
      if (excludeIds?.has(node.id)) continue;
      const label = prefix ? `${prefix} / ${node.name}` : node.name;
      options.push({ id: node.id, slug: node.slug, label, isLeaf: node.children.length === 0 });
      walk(node.children, label);
    }
  }
  walk(tree, "");
  return options;
}

function collectDescendantIds(node: CategoryTreeNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectDescendantIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}

export function getDescendantIds(tree: CategoryTreeNode[], nodeId: string): Set<string> {
  const node = findNodeInTree(tree, nodeId);
  if (!node) return new Set();
  const ids = collectDescendantIds(node);
  ids.delete(nodeId);
  return ids;
}

export async function isCategoryLeaf(categorySlug: string): Promise<boolean> {
  if (!databaseConfigured()) return true;
  const category = await safeQuery(() =>
    prisma.category.findUnique({
      where: { slug: categorySlug },
      include: { _count: { select: { children: true } } },
    }),
  );
  if (!category) return true;
  return category._count.children === 0;
}

// --- Homepage Sections ---

export type HomepageSectionData = {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  items: HomepageSectionItem[];
};

export type HomepageSectionItem = {
  id: string;
  position: number;
  isHighlighted: boolean;
  product: {
    slug: string;
    name: string;
    brand: string;
    imageUrl: string | null;
    imageUrls: string[];
    price: number;
    compareAtPrice?: number;
    inStock: boolean;
    categorySlug: string;
    badge?: string;
  } | null;
};

export async function loadHomepageSections(): Promise<HomepageSectionData[]> {
  const sections = await safeQuery(() =>
    prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    }),
  );

  if (!sections) return [];

  return sections.map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    sortOrder: section.sortOrder,
    items: section.items
      .filter((item) => item.product)
      .map((item) => ({
        id: item.id,
        position: item.position,
        isHighlighted: item.isHighlighted,
        product: item.product
          ? {
              slug: item.product.slug,
              name: item.product.name,
              brand: item.product.brand,
              imageUrl: item.product.imageUrls[0] ?? item.product.imageUrl,
              imageUrls: item.product.imageUrls.length > 0
                ? item.product.imageUrls
                : item.product.imageUrl
                  ? [item.product.imageUrl]
                  : [],
              price: Number(item.product.price),
              inStock: item.product.inStock,
              categorySlug: item.product.category.slug,
            }
          : null,
      })),
  }));
}