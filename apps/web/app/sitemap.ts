import type { MetadataRoute } from "next";
import { loadCategoryTree, getAllCategorySlugs } from "../lib/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const staticPaths = ["", "/catalog", "/trade-in", "/service", "/cart"];
  const staticEntries = staticPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const tree = await loadCategoryTree();
  const categorySlugs = getAllCategorySlugs(tree);
  const categoryEntries = categorySlugs.map((slug) => ({
    url: `${baseUrl}/catalog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...categoryEntries];
}