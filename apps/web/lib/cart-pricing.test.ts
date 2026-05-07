import { describe, expect, it } from "vitest";
import { buildCartEntriesWithPricing, resolveAccessoryBundlePricing, roundAccessoryBundlePrice } from "./cart-pricing";

describe("cart pricing", () => {
  it("rounds accessory bundle prices to a price ending in 100 when possible", () => {
    expect(roundAccessoryBundlePrice(960)).toBe(1100);
    expect(roundAccessoryBundlePrice(2240)).toBe(2100);
    expect(roundAccessoryBundlePrice(4010)).toBe(4100);
  });

  it("applies accessory bundle discount pricing", () => {
    expect(resolveAccessoryBundlePricing(2800)).toEqual({
      compareAtPrice: 2800,
      discountedPrice: 2100,
      discountPercent: 20,
    });
  });

  it("treats nested accessory category slugs as accessories", () => {
    const withDevice = buildCartEntriesWithPricing({
      cartItems: [
        { itemKey: "iphone-17-pro-max", productSlug: "iphone-17-pro-max", quantity: 1, unitPrice: 120700 },
        { itemKey: "apple-20w", productSlug: "apple-20w", quantity: 1, unitPrice: 2800 },
      ],
      products: [
        { slug: "iphone-17-pro-max", categorySlug: "iphone" },
        { slug: "apple-20w", categorySlug: "novye-ustroystva-apple-aksessuary" },
      ],
    });

    expect(withDevice[1]).toMatchObject({
      hasBundleDiscount: true,
      effectiveUnitPrice: 2100,
      compareAtUnitPrice: 2800,
    });
  });

  it("discounts accessory items only when a device is present in the cart", () => {
    const products = [
      { slug: "iphone-17-pro-max", categorySlug: "iphone" },
      { slug: "apple-20w", categorySlug: "accessories" },
    ];

    const withDevice = buildCartEntriesWithPricing({
      cartItems: [
        { itemKey: "iphone-17-pro-max", productSlug: "iphone-17-pro-max", quantity: 1, unitPrice: 120700 },
        { itemKey: "apple-20w", productSlug: "apple-20w", quantity: 1, unitPrice: 2800 },
      ],
      products,
    });

    expect(withDevice[1]).toMatchObject({
      hasBundleDiscount: true,
      effectiveUnitPrice: 2100,
      compareAtUnitPrice: 2800,
      bundleDiscountPercent: 20,
    });

    const accessoryOnly = buildCartEntriesWithPricing({
      cartItems: [
        { itemKey: "apple-20w", productSlug: "apple-20w", quantity: 1, unitPrice: 2800 },
      ],
      products,
    });

    expect(accessoryOnly[0]).toMatchObject({
      hasBundleDiscount: false,
      effectiveUnitPrice: 2800,
      compareAtUnitPrice: undefined,
    });
  });
});