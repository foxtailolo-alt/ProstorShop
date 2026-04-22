import type { MetadataRoute } from "next";
import { getAllCategorySlugs, listCatalogProducts, loadCategoryTree } from "../lib/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lastModified = new Date();

  const staticPaths = ["", "/catalog", "/trade-in", "/service", "/cart"];
  const staticEntries = staticPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const [tree, products] = await Promise.all([loadCategoryTree(), listCatalogProducts()]);
  const categorySlugs = getAllCategorySlugs(tree);
  const categoryEntries = categorySlugs.map((slug) => ({
    url: `${baseUrl}/catalog/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const productEntries = products.map((product) => ({
    url: `${baseUrl}/catalog/${product.categorySlug}/${product.slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}