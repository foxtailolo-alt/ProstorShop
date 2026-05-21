import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@prostor/core";
import {
  buildUsedDeviceWaitlistModelRank,
  findUsedDeviceWaitlistMatches,
  matchUsedDeviceWaitlistEntryToProduct,
} from "./used-device-waitlist";

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

describe("used device waitlist matcher", () => {
  it("matches grouped light and dark color preferences", () => {
    const lightEntry = {
      categoryCode: "iphone",
      brand: "Apple",
      model: "15 Pro",
      storage: "256 ГБ",
      color: "Светлый",
      modelRank: buildUsedDeviceWaitlistModelRank({ categoryCode: "iphone", brand: "Apple", model: "15 Pro" }),
    };

    const darkEntry = {
      categoryCode: "iphone",
      brand: "Apple",
      model: "15 Pro",
      storage: "256 ГБ",
      color: "Темный",
      modelRank: buildUsedDeviceWaitlistModelRank({ categoryCode: "iphone", brand: "Apple", model: "15 Pro" }),
    };

    const naturalProduct = makeProduct({
      slug: "iphone-15-pro-natural",
      categorySlug: "trade-in-ustroystva-trade-in-smartfony",
      name: "iPhone 15 Pro 256Gb | Natural",
      brand: "Trade-in смартфоны",
      price: 89_000,
      attributes: {
        storage: "256 ГБ",
        color: "Natural",
      },
    });

    const whiteProduct = makeProduct({
      slug: "iphone-15-pro-white",
      categorySlug: "trade-in-ustroystva-trade-in-smartfony",
      name: "iPhone 15 Pro 256Gb | White",
      brand: "Trade-in смартфоны",
      price: 89_000,
      attributes: {
        storage: "256 ГБ",
        color: "White",
      },
    });

    expect(matchUsedDeviceWaitlistEntryToProduct(lightEntry, whiteProduct).isMatch).toBe(true);
    expect(matchUsedDeviceWaitlistEntryToProduct(lightEntry, naturalProduct).isMatch).toBe(false);
    expect(matchUsedDeviceWaitlistEntryToProduct(darkEntry, naturalProduct).isMatch).toBe(true);
  });

  it("prefers attribute-based exact matches for requested storage and color", () => {
    const entry = {
      categoryCode: "iphone",
      brand: "Apple",
      model: "15 Pro",
      storage: "256 ГБ",
      color: "Natural",
      modelRank: buildUsedDeviceWaitlistModelRank({ categoryCode: "iphone", brand: "Apple", model: "15 Pro" }),
    };

    const product = makeProduct({
      slug: "iphone-15-pro-used",
      categorySlug: "trade-in-ustroystva-trade-in-smartfony",
      name: "iPhone 15 Pro 256Gb | Natural",
      brand: "Trade-in смартфоны",
      price: 89_000,
      attributes: {
        storage: "256 ГБ",
        color: "Natural",
      },
    });

    const result = matchUsedDeviceWaitlistEntryToProduct(entry, product);
    expect(result.isMatch).toBe(true);
    expect(result.matchSource).toBe("attribute");
    expect(result.breakdown?.storage.matched).toBe(true);
    expect(result.breakdown?.color.matched).toBe(true);
  });

  it("falls back to product title when structured attributes are missing", () => {
    const entry = {
      categoryCode: "ipad",
      brand: "Apple",
      model: "Pro 11 M4",
      storage: "256 ГБ",
      displaySize: '11"',
      connectivity: "Wi-Fi",
      modelRank: buildUsedDeviceWaitlistModelRank({ categoryCode: "ipad", brand: "Apple", model: "Pro 11 M4" }),
    };

    const product = makeProduct({
      slug: "ipad-pro-11-m4-used",
      categorySlug: "trade-in-ustroystva-trade-in-planshety",
      name: "iPad Pro 11 M4 256Gb Wi-Fi | Space Black",
      brand: "Trade-in планшеты",
      price: 77_000,
      attributes: {},
    });

    const result = matchUsedDeviceWaitlistEntryToProduct(entry, product);
    expect(result.isMatch).toBe(true);
    expect(result.matchSource).toBe("title_fallback");
    expect(result.breakdown?.storage.source).toBe("title");
    expect(result.breakdown?.displaySize.source).toBe("title");
    expect(result.breakdown?.connectivity.source).toBe("title");
  });

  it("filters out products with a different exact intent", () => {
    const entry = {
      categoryCode: "iphone",
      brand: "Apple",
      model: "15 Pro",
      storage: "256 ГБ",
      color: "Natural",
      modelRank: buildUsedDeviceWaitlistModelRank({ categoryCode: "iphone", brand: "Apple", model: "15 Pro" }),
    };

    const matches = findUsedDeviceWaitlistMatches(entry, [
      makeProduct({
        slug: "iphone-15-pro-natural",
        categorySlug: "trade-in-ustroystva-trade-in-smartfony",
        name: "iPhone 15 Pro 256Gb | Natural",
        brand: "Trade-in смартфоны",
        price: 92_000,
        attributes: { storage: "256 ГБ", color: "Natural" },
      }),
      makeProduct({
        slug: "iphone-15-pro-blue",
        categorySlug: "trade-in-ustroystva-trade-in-smartfony",
        name: "iPhone 15 Pro 256Gb | Blue",
        brand: "Trade-in смартфоны",
        price: 91_000,
        attributes: { storage: "256 ГБ", color: "Blue" },
      }),
      makeProduct({
        slug: "iphone-15-used",
        categorySlug: "trade-in-ustroystva-trade-in-smartfony",
        name: "iPhone 15 256Gb | Natural",
        brand: "Trade-in смартфоны",
        price: 84_000,
        attributes: { storage: "256 ГБ", color: "Natural" },
      }),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.product.slug).toBe("iphone-15-pro-natural");
  });
});