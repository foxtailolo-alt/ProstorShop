import { describe, expect, it } from "vitest";
import { buildPriceText, formatProductPrice, resolveProductPrice } from "./pricing";

describe("pricing helpers", () => {
  it("applies an active percent discount and returns compare-at price", () => {
    expect(resolveProductPrice({
      basePrice: 100_000,
      discountType: "percent",
      discountValue: 10,
    })).toEqual({
      price: 90_000,
      compareAtPrice: 100_000,
      isDiscountActive: true,
      discountEndsAt: undefined,
    });
  });

  it("ignores an expired discount", () => {
    expect(resolveProductPrice({
      basePrice: 100_000,
      discountType: "fixed",
      discountValue: 5_000,
      discountEndsAt: "2025-01-01T00:00:00.000Z",
      now: new Date("2026-04-28T12:00:00.000Z"),
    })).toEqual({
      price: 100_000,
      isDiscountActive: false,
      discountEndsAt: new Date("2025-01-01T00:00:00.000Z"),
    });
  });

  it("builds a strikethrough HTML price string for Telegram", () => {
    expect(buildPriceText(90_000, 100_000)).toBe(`<s>${formatProductPrice(100_000)}</s> ${formatProductPrice(90_000)}`);
  });
});