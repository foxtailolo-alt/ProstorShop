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
  it("prioritizes iPhone 17 lineup for new inventory and keeps all matching trade-in variants", () => {
    const products: CatalogProduct[] = [
      makeProduct({ slug: "iphone-12-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 12 128Gb | Black", brand: "Trade-in смартфоны", price: 27_700 }),
      makeProduct({ slug: "iphone-13-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 13 128Gb | Midnight", brand: "Trade-in смартфоны", price: 31_700 }),
      makeProduct({ slug: "iphone-14-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 128Gb | Purple", brand: "Trade-in смартфоны", price: 37_700 }),
      makeProduct({ slug: "iphone-14-pro-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 Pro 128Gb | Deep Purple", brand: "Trade-in смартфоны", price: 49_700 }),
      makeProduct({ slug: "iphone-14-pro-max-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 14 Pro Max 256Gb | Gold", brand: "Trade-in смартфоны", price: 57_700 }),
      makeProduct({ slug: "iphone-15-used", categorySlug: "trade-in-ustroystva-trade-in-smartfony", name: "iPhone 15 128Gb | Black", brand: "Trade-in смартфоны", price: 61_700 }),
      makeProduct({ slug: "iphone-15-pro-max-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 15 Pro Max, Natural", brand: "Apple", price: 109_700 }),
      makeProduct({ slug: "iphone-17-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 17, Pink", brand: "Apple", price: 79_700 }),
      makeProduct({ slug: "iphone-17-pro-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 17 Pro, Sage", brand: "Apple", price: 99_700 }),
      makeProduct({ slug: "iphone-17-pro-max-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 17 Pro Max, Deep Blue", brand: "Apple", price: 109_700 }),
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

    expect(suggestions).toHaveLength(7);
    expect(suggestions.every((item) => !item.name.includes("iPhone 12") && !item.name.includes("iPhone 13"))).toBe(true);
    expect(suggestions.slice(0, 3).map((item) => item.name)).toEqual([
      "iPhone 17 Pro Max, Deep Blue",
      "iPhone 17 Pro, Sage",
      "iPhone 17, Pink",
    ]);
    expect(suggestions.filter((item) => item.inventoryKind === "trade-in").map((item) => item.name)).toHaveLength(4);
    expect(suggestions.filter((item) => item.inventoryKind === "trade-in").map((item) => item.name).sort()).toEqual([
      "iPhone 14 128Gb | Purple",
      "iPhone 14 Pro 128Gb | Deep Purple",
      "iPhone 14 Pro Max 256Gb | Gold",
      "iPhone 15 128Gb | Black",
    ].sort());
  });

  it("preserves fallback image urls for upgrade cards", () => {
    const suggestions = buildUpgradeSuggestions(
      {
        categoryCode: "iphone",
        brand: "Apple",
        model: "16",
        storage: "256 ГБ",
        estimatedTradeInValue: 60_000,
      },
      [
        makeProduct({
          slug: "iphone-17-pro-max-deep-blue",
          categorySlug: "novye-ustroystva-apple-iphone",
          name: "iPhone 17 Pro Max, Deep Blue",
          brand: "Apple",
          price: 108_700,
          imageUrl: "/uploads/products/iphone-17-pro-max-deep-blue-stale.webp",
          imageUrls: [
            "/uploads/products/iphone-17-pro-max-deep-blue-stale.webp",
            "/uploads/products/iphone-17-pro-max-deep-blue-ba46cd2a-fd14-4dbd-b06e-160caaeac9ca.webp",
          ],
        }),
      ],
      categoryTree,
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.imageUrls).toEqual([
      "/uploads/products/iphone-17-pro-max-deep-blue-stale.webp",
      "/uploads/products/iphone-17-pro-max-deep-blue-ba46cd2a-fd14-4dbd-b06e-160caaeac9ca.webp",
    ]);
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

  it("supports legacy smartphone category codes when building iphone suggestions", () => {
    const suggestions = buildUpgradeSuggestions(
      {
        categoryCode: "smartphone",
        brand: "Apple",
        model: "iPhone 13",
        storage: "128 ГБ",
        estimatedTradeInValue: 25_000,
      },
      [
        makeProduct({ slug: "iphone-14-new", categorySlug: "novye-ustroystva-apple-iphone", name: "iPhone 14, Blue", brand: "Apple", price: 69_700 }),
      ],
      categoryTree,
    );

    expect(suggestions.map((item) => item.name)).toEqual(["iPhone 14, Blue"]);
  });

  it("keeps watch ultras and newer series while excluding the same watch generation", () => {
    const watchCategoryTree: CategoryTreeNode[] = [
      {
        id: "root-watch-new",
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
            id: "new-watch",
            name: "Apple Watch",
            slug: "novye-ustroystva-apple-apple-watch",
            imageUrl: null,
            position: 0,
            parentId: "root-watch-new",
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

    const suggestions = buildUpgradeSuggestions(
      {
        categoryCode: "apple_watch",
        brand: "Apple",
        model: "Apple Watch S10 46mm",
        storage: null,
        estimatedTradeInValue: 18_000,
      },
      [
        makeProduct({ slug: "watch-s10", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch S10", brand: "Apple", price: 49_700 }),
        makeProduct({ slug: "watch-s11", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch S11", brand: "Apple", price: 55_700 }),
        makeProduct({ slug: "watch-ultra-3", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch Ultra 3", brand: "Apple", price: 89_700 }),
      ],
      watchCategoryTree,
    );

    expect(suggestions.map((item) => item.name)).toEqual([
      "Apple Watch S11",
      "Apple Watch Ultra 3",
    ]);
  });

  it("supports Apple Watch Series naming and excludes the current generation", () => {
    const watchCategoryTree: CategoryTreeNode[] = [
      {
        id: "root-watch-new",
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
            id: "new-watch",
            name: "Apple Watch",
            slug: "novye-ustroystva-apple-apple-watch",
            imageUrl: null,
            position: 0,
            parentId: "root-watch-new",
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

    const suggestions = buildUpgradeSuggestions(
      {
        categoryCode: "apple_watch",
        brand: "Apple",
        model: "Apple Watch S10 46mm",
        storage: null,
        estimatedTradeInValue: 18_000,
      },
      [
        makeProduct({ slug: "watch-series-10", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch Series 10", brand: "Apple", price: 49_700 }),
        makeProduct({ slug: "watch-series-11", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch Series 11", brand: "Apple", price: 56_700 }),
      ],
      watchCategoryTree,
    );

    expect(suggestions.map((item) => item.name)).toEqual([
      "Apple Watch Series 11",
    ]);
  });

  it("supports normalized saved watch models like Series 10 and still surfaces S11", () => {
    const watchCategoryTree: CategoryTreeNode[] = [
      {
        id: "root-watch-new",
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
            id: "new-watch",
            name: "Apple Watch",
            slug: "novye-ustroystva-apple-apple-watch",
            imageUrl: null,
            position: 0,
            parentId: "root-watch-new",
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

    const suggestions = buildUpgradeSuggestions(
      {
        categoryCode: "apple_watch",
        brand: "Apple Watch",
        model: "Series 10",
        storage: null,
        estimatedTradeInValue: 11_000,
      },
      [
        makeProduct({ slug: "watch-s10", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch S10, Silver", brand: "Apple", price: 29_700 }),
        makeProduct({ slug: "watch-s11", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch S11, Silver", brand: "Apple", price: 29_700 }),
        makeProduct({ slug: "watch-ultra-3", categorySlug: "novye-ustroystva-apple-apple-watch", name: "Apple Watch Ultra 3 49mm", brand: "Apple", price: 67_700 }),
      ],
      watchCategoryTree,
    );

    expect(suggestions.map((item) => item.name)).toEqual([
      "Apple Watch S11, Silver",
      "Apple Watch Ultra 3 49mm",
    ]);
  });
});