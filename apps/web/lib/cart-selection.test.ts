import { describe, expect, it } from "vitest";
import { getDefaultVariantLabel, parseProductOptions, resolveVariantSelection, type ProductOptionsData } from "./cart-selection";

describe("cart selection helpers", () => {
  it("returns base price when product has no options", () => {
    expect(resolveVariantSelection(89990, null, "")).toEqual({
      variantLabel: undefined,
      unitPrice: 89990,
    });
  });

  it("uses the default all-variants combination when no variant was posted", () => {
    const options: ProductOptionsData = {
      groups: [
        { name: "Storage", values: ["128GB", "256GB"] },
        { name: "Color", values: ["Black", "Blue"] },
      ],
      allVariants: true,
      variants: [
        { name: "128GB + Black", price: 99990 },
        { name: "256GB + Blue", price: 119990 },
      ],
    };

    expect(getDefaultVariantLabel(options)).toBe("128GB + Black");
    expect(resolveVariantSelection(94990, options, "")).toEqual({
      variantLabel: "128GB + Black",
      unitPrice: 99990,
    });
  });

  it("calculates additive option pricing from the normalized label", () => {
    const options: ProductOptionsData = {
      groups: [
        { name: "Storage", values: ["128GB", "256GB"] },
        { name: "SIM", values: ["eSIM", "Dual SIM"] },
      ],
      allVariants: false,
      prices: {
        Storage: { "128GB": 0, "256GB": 12000 },
        SIM: { eSIM: 0, "Dual SIM": 4000 },
      },
    };

    expect(resolveVariantSelection(79990, options, "256GB + Dual SIM")).toEqual({
      variantLabel: "256GB + Dual SIM",
      unitPrice: 95990,
    });
  });

  it("falls back to the default values when the posted label is invalid", () => {
    const options: ProductOptionsData = {
      groups: [
        { name: "Storage", values: ["128GB", "256GB"] },
        { name: "Color", values: ["Black", "Blue"] },
      ],
      allVariants: false,
      prices: {
        Storage: { "128GB": 0, "256GB": 10000 },
        Color: { Black: 0, Blue: 1500 },
      },
    };

    expect(resolveVariantSelection(69990, options, "1TB + Gold")).toEqual({
      variantLabel: "128GB + Black",
      unitPrice: 69990,
    });
  });

  it("rejects malformed options payloads", () => {
    expect(parseProductOptions(null)).toBeNull();
    expect(parseProductOptions({ groups: [] })).toBeNull();
  });
});