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
    record.attributes.length > 0
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