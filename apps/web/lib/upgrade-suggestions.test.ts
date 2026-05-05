import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@prostor/core";
import type { CategoryTreeNode } from "./data/catalog";
import { buildUpgradeSuggestions, findUsedInventoryCandidates } from "./upgrade-suggestions";

function makeProduct(input: Partial<CatalogProduct> & Pick<CatalogProduct, "slug" | "categorySlug" | "name" | "brand" | "price">): CatalogProduct {
  return {
    sku: input.sku ?? input.slug,
    slug: input.slug,
    categorySlug: input.categorySlug,
    name: input.name,
    brand: input.brand,
    imageUrl: input.imageUrl,
    imageUrls: input.imageUrls ?? [],
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountEndsAt: input.discountEndsAt,
    badge: input.badge,
    summary: input.summary ?? input.name,
    highlights: input.highlights ?? [input.name, input.brand, "В наличии"],
    specs: input.specs ?? {},
    attributes: input.attributes ?? {},
    inStock: input.inStock ?? true,
    featured: input.featured ?? false,
  };
}

const categoryTree: CategoryTreeNode[] = [
  {
    id: "root-new",
    name: "Новые устройства",
    slug: "novye-ustroystva",
    imageUrl: null,
    position: 0,
    parentId: null,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: [],
    productCount: 0,
    childCount: 1,
    children: [
      {
        id: "new-iphone",
        name: "iPhone",
        slug: "novye-ustroystva-apple-iphone",
        imageUrl: null,
        position: 0,
        parentId: "root-new",
        seoTitle: null,
        seoDescription: null,
        seoKeywords: [],
        productCount: 0,
        childCount: 0,
        children: [],
      },
    ],
  },
  {
    id: "root-used",
    name: "Trade-in устройства",
    slug: "trade-in-ustroystva",
    imageUrl: null,
    position: 1,
    parentId: null,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: [],
    productCount: 0,
    childCount: 1,
    children: [
      {
        id: "used-iphone",
        name: "Trade-in смартфоны",
        slug: "trade-in-ustroystva-trade-in-smartfony",
        imageUrl: null,
        position: 0,
        parentId: "root-used",
        seoTitle: null,
        seoDescription: null,
        seoKeywords: [],
        productCount: 0,
        childCount: 0,
        children: [],
      },
    ],
  },
];

describe("upgrade suggestions", () => {
  it("returns only newer iPhone models for both new and trade-in inventory", () => {
    const products: CatalogProduct[] = [
      makeProduct({ slug: "iphone-12-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 12 128Gb | Black", brand: "Trade-in смартфоны", price: 27_700 }),
      makeProduct({ slug: "iphone-13-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 13 128Gb | Midnight", brand: "Trade-in смартфоны", price: 31_700 }),
      makeProduct({ slug: "iphone-14-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 128Gb | Purple", brand: "Trade-in смартфоны", price: 37_700 }),
      makeProduct({ slug: "iphone-14-pro-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 Pro 128Gb | Deep Purple", brand: "Trade-in смартфоны", price: 49_700 }),
      makeProduct({ slug: "iphone-14-pro-max-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 Pro Max 256Gb | Gold", brand: "Trade-in смартфоны", price: 57_700 }),
      makeProduct({ slug: "iphone-13-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 13, Blue", brand: "Apple", price: 59_700 }),
      makeProduct({ slug: "iphone-14-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 14, Purple", brand: "Apple", price: 69_700 }),
      makeProduct({ slug: "iphone-14-pro-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 14 Pro, Graphite", brand: "Apple", price: 89_700 }),
      makeProduct({ slug: "iphone-15-pro-max-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 15 Pro Max, Natural", brand: "Apple", price: 109_700 }),
    ];

    const suggestions = buildUpgradeSuggestions(
      {
        categoryCode: "iphone",
        brand: "Apple",
        model: "13",
        storage: "128 ГБ",
        estimatedTradeInValue: 25_000,
      },
      products,
      categoryTree,
    );

    expect(suggestions).toHaveLength(6);
    expect(suggestions.every((item) => !item.name.includes("iPhone 12") && !item.name.includes("iPhone 13"))).toBe(true);
    expect(suggestions.some((item) => item.name.includes("iPhone 14, Purple"))).toBe(true);
    expect(suggestions.some((item) => item.name.includes("iPhone 14 Pro, Graphite"))).toBe(true);
    expect(suggestions.some((item) => item.name.includes("iPhone 14 Pro Max 256Gb | Gold"))).toBe(true);
  });

  it("used inventory candidates also exclude same or older models", () => {
    const products: CatalogProduct[] = [
      makeProduct({ slug: "iphone-13-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 13 128Gb | Midnight", brand: "Trade-in смартфоны", price: 31_700 }),
      makeProduct({ slug: "iphone-14-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 128Gb | Purple", brand: "Trade-in смартфоны", price: 37_700 }),
      makeProduct({ slug: "iphone-15-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 15 256Gb | Black", brand: "Trade-in смартфоны", price: 47_700 }),
    ];

    const candidates = findUsedInventoryCandidates(
      {
        categoryCode: "iphone",
        brand: "Apple",
        model: "13",
        storage: "128 ГБ",
        estimatedTradeInValue: 25_000,
      },
      products,
      categoryTree,
    );

    expect(candidates.map((item) => item.name)).toEqual([
      "iPhone 14 128Gb | Purple",
      "iPhone 15 256Gb | Black",
    ]);
  });
});