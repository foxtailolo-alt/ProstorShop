import { describe, expect, it } from "vitest";
import { normalizeProductOptionsOrder } from "./product-options-order";

describe("product options order", () => {
  it("sorts storage values from smallest to largest", () => {
    const normalized = normalizeProductOptionsOrder({
      groups: [
        {
          name: "Память",
          values: ["1Tb", "2Tb", "256Gb", "512Gb"],
        },
      ],
      allVariants: true,
      variants: [
        { name: "1Tb", price: 130700 },
        { name: "2Tb", price: 150700 },
        { name: "256Gb", price: 100700 },
        { name: "512Gb", price: 110700 },
      ],
    });

    expect(normalized.groups[0]?.values).toEqual(["256Gb", "512Gb", "1Tb", "2Tb"]);
  });

  it("sorts composite memory labels by storage capacity", () => {
    const normalized = normalizeProductOptionsOrder({
      groups: [
        {
          name: "Память",
          values: ["8/1Tb", "8/512Gb", "8/256Gb"],
        },
      ],
      allVariants: true,
    });

    expect(normalized.groups[0]?.values).toEqual(["8/256Gb", "8/512Gb", "8/1Tb"]);
  });
});