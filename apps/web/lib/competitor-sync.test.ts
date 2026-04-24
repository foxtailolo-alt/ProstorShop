import { describe, expect, it } from "vitest";
import { buildProposalForProduct, matchCompetitorUrlForProduct } from "./competitor-sync";

describe("competitor sync URL matching", () => {
  const urls = [
    "https://resale52.ru/iphone/iphone-17/iphone-17-pro",
    "https://resale52.ru/iphone/iphone-17/iphone-17-pro-max",
  ];

  it("matches iPhone 17 Pro base page for multi-word color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-1",
        name: "iPhone 17 Pro, Deep Blue",
        slug: "iphone-17-pro-deep-blue",
        sku: "PRO-0186",
        brand: "Apple",
        price: 98700,
        options: null,
      },
      urls,
    );

    expect(match).toEqual({
      url: "https://resale52.ru/iphone/iphone-17/iphone-17-pro",
      score: 100,
    });
  });

  it("matches iPhone 17 Pro Max base page for multi-word color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-2",
        name: "iPhone 17 Pro Max, Cosmic Orange",
        slug: "iphone-17-pro-max-cosmic-orange",
        sku: "PRO-0190",
        brand: "Apple",
        price: 114700,
        options: null,
      },
      urls,
    );

    expect(match).toEqual({
      url: "https://resale52.ru/iphone/iphone-17/iphone-17-pro-max",
      score: 100,
    });
  });

  it("matches MacBook Neo base page for Russian indigo color names", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-3",
        name: "MacBook Neo, Индиго",
        slug: "macbook-neo-indigo",
        sku: "PRO-0311",
        brand: "Apple",
        price: 62700,
        options: null,
      },
      ["https://resale52.ru/mac/macbook-air/macbook-neo"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/mac/macbook-air/macbook-neo",
      score: 100,
    });
  });

  it("matches MacBook Air base page for midnight color names", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-5",
        name: "MacBook Air 13 M5, Midnight",
        slug: "macbook-air-13-m5-midnight",
        sku: "PRO-0326",
        brand: "Apple",
        price: 119700,
        options: null,
      },
      ["https://resale52.ru/mac/macbook-air/macbook-air-13-m5"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/mac/macbook-air/macbook-air-13-m5",
      score: 100,
    });
  });

  it("matches MacBook Air base page for sky blue color names", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-6",
        name: "MacBook Air 15 M5, Sky Blue",
        slug: "macbook-air-15-m5-sky-blue",
        sku: "PRO-0329",
        brand: "Apple",
        price: 139700,
        options: null,
      },
      ["https://resale52.ru/mac/macbook-air/macbook-air-15-m5"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/mac/macbook-air/macbook-air-15-m5",
      score: 100,
    });
  });

  it("matches MacBook Pro base page for misspelled Russian silver names", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-7",
        name: "MacBook Pro 14 M4 Pro, Серебрянный",
        slug: "macbook-pro-14-m4-pro-serebryannyy",
        sku: "PRO-0087",
        brand: "Apple",
        price: 189700,
        options: null,
      },
      ["https://resale52.ru/mac/macbook-pro/macbook-pro-14-m4-pro"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/mac/macbook-pro/macbook-pro-14-m4-pro",
      score: 100,
    });
  });
});

describe("competitor sync option matching", () => {
  it("fixes MacBook Neo blush color from Russian pink product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-4",
        name: "MacBook Neo, Розовый",
        slug: "macbook-neo-rozovyy",
        sku: "PRO-0310",
        brand: "Apple",
        price: 62700,
        options: null,
      },
      {
        url: "https://resale52.ru/mac/macbook-air/macbook-neo",
        title: "MacBook Neo",
        basePrice: 59990,
        groups: [
          { name: "Память", values: ["8/256Gb", "8/512Gb"] },
          { name: "Цвет", values: ["Silver", "Blush", "Citrus", "Indigo"] },
        ],
        variants: [
          { selections: { "Память": "8/256Gb", "Цвет": "Silver" }, price: 59990 },
          { selections: { "Память": "8/256Gb", "Цвет": "Blush" }, price: 59990 },
          { selections: { "Память": "8/256Gb", "Цвет": "Citrus" }, price: 59990 },
          { selections: { "Память": "8/256Gb", "Цвет": "Indigo" }, price: 59990 },
          { selections: { "Память": "8/512Gb", "Цвет": "Silver" }, price: 69990 },
          { selections: { "Память": "8/512Gb", "Цвет": "Blush" }, price: 69990 },
          { selections: { "Память": "8/512Gb", "Цвет": "Citrus" }, price: 69990 },
          { selections: { "Память": "8/512Gb", "Цвет": "Indigo" }, price: 69990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Blush.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/256Gb", "8/512Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/256Gb", price: 61700 },
        { name: "8/512Gb", price: 71700 },
      ],
    });
  });
});