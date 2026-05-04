import { describe, expect, it } from "vitest";
import { buildProposalForProduct, matchCompetitorUrlForProduct, normalizeScrapedOptionGroups } from "./competitor-sync";

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

  it("matches iPhone 17 base page for Sage color names", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-2a",
        name: "iPhone 17, Sage",
        slug: "iphone-17-sage",
        sku: "PRO-0179",
        brand: "Apple",
        price: 64700,
        options: null,
      },
      ["https://resale52.ru/iphone/iphone-17/iphone-17"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/iphone/iphone-17/iphone-17",
      score: 100,
    });
  });

  it("matches iPhone 17 base page for Mist Blue multi-word color names", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-2b",
        name: "iPhone 17, Mist blue",
        slug: "iphone-17-mist-blue",
        sku: "PRO-0181",
        brand: "Apple",
        price: 63700,
        options: null,
      },
      ["https://resale52.ru/iphone/iphone-17/iphone-17"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/iphone/iphone-17/iphone-17",
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

  it("matches iPad Air 11 M3 base page even though competitor keeps size as an option", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-7a",
        name: 'iPad Air 11" m3 (2025), Серый',
        slug: "ipad-air-11-m3-2025-seryy",
        sku: "PRO-0061",
        brand: "Apple",
        price: 52700,
        options: null,
      },
      ["https://resale52.ru/tablet/apple-ipad/apple-ipad-air-m3-2025"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/tablet/apple-ipad/apple-ipad-air-m3-2025",
      score: 80,
    });
  });

  it("matches iPad Pro 13 M5 base page even though competitor keeps size as an option", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-7b",
        name: 'iPad Pro 13" m5 (2025), Серебристый',
        slug: "ipad-pro-13-m5-2025-serebristyy",
        sku: "PRO-0244",
        brand: "Apple",
        price: 119700,
        options: null,
      },
      ["https://resale52.ru/tablet/apple-ipad/apple-ipad-pro-m5-2025"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/tablet/apple-ipad/apple-ipad-pro-m5-2025",
      score: 80,
    });
  });

  it("matches Samsung Z Fold 7 base page for transliterated blue color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-8",
        name: "Samsung Galaxy Z Fold 7, Синий",
        slug: "samsung-galaxy-z-fold-7-siniy",
        sku: "PRO-0074",
        brand: "Samsung",
        price: 110700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-z-fold-7"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-z-fold-7",
      score: 100,
    });
  });

  it("matches Samsung Z Fold 7 base page for transliterated gray color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-9",
        name: "Samsung Galaxy Z Fold 7, Серый",
        slug: "samsung-galaxy-z-fold-7-seryy",
        sku: "PRO-0073",
        brand: "Samsung",
        price: 110700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-z-fold-7"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-z-fold-7",
      score: 100,
    });
  });

  it("matches Samsung Z Flip 7 base page for transliterated coral color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-9a",
        name: "Samsung Galaxy Z Flip 7, Коралловый",
        slug: "samsung-galaxy-z-flip-7-korallovyy",
        sku: "PRO-0164",
        brand: "Samsung",
        price: 69700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-z-flip-7"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-z-flip-7",
      score: 100,
    });
  });

  it("matches Samsung A37 base page for lavender color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-9b",
        name: "Samsung Galaxy A37, Лавандовый",
        slug: "samsung-galaxy-a37-lavandovyy",
        sku: "PRO-0323",
        brand: "Samsung",
        price: 27700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-a37"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-a37",
      score: 100,
    });
  });

  it("matches Samsung A36 base page for lavender color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-9c",
        name: "Samsung Galaxy A36, лавандовый",
        slug: "samsung-galaxy-a36-lavandovyy",
        sku: "PRO-0020",
        brand: "Samsung",
        price: 20700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-a36"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-a36",
      score: 100,
    });
  });

  it("matches Samsung A36 base page for lime color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-9d",
        name: "Samsung Galaxy A36, лаймовый",
        slug: "samsung-galaxy-a36-laymovyy",
        sku: "PRO-0021",
        brand: "Samsung",
        price: 20700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-a36"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-a36",
      score: 100,
    });
  });

  it("matches Samsung Galaxy Watch Ultra base page on samsung-watch competitor paths", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-9e",
        name: "Samsung Galaxy Watch Ultra 49mm LTE, Серые",
        slug: "samsung-galaxy-watch-ultra-49mm-lte-serye",
        sku: "PRO-0099",
        brand: "Samsung",
        price: 59700,
        options: null,
      },
      ["https://resale52.ru/watch/samsung-watch/samsung-galaxy-watch-ultra"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/watch/samsung-watch/samsung-galaxy-watch-ultra",
      score: 100,
    });
  });

  it("matches Samsung S26 Ultra base page for transliterated color slugs", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-10",
        name: "Samsung Galaxy S26 Ultra, Черный",
        slug: "samsung-galaxy-s26-ultra-chernyy",
        sku: "PRO-0262",
        brand: "Samsung",
        price: 149700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-s-26-ultra"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-s-26-ultra",
      score: 100,
    });
  });

  it("matches Samsung S26 Plus base page from product name with plus sign", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-11",
        name: "Samsung Galaxy S26+, Белый",
        slug: "samsung-galaxy-s26-belyy",
        sku: "PRO-0263",
        brand: "Samsung",
        price: 114700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-s-26-plus"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-s-26-plus",
      score: 100,
    });
  });

  it("matches Samsung S26 base page for duplicate local slugs with numeric suffixes", () => {
    const match = matchCompetitorUrlForProduct(
      {
        id: "product-12",
        name: "Samsung Galaxy S26, Черный",
        slug: "samsung-galaxy-s26-chernyy-2",
        sku: "PRO-0270",
        brand: "Samsung",
        price: 99700,
        options: null,
      },
      ["https://resale52.ru/android/samsung/samsung-s-26"],
    );

    expect(match).toEqual({
      url: "https://resale52.ru/android/samsung/samsung-s-26",
      score: 100,
    });
  });
});

describe("competitor sync option matching", () => {
  it("keeps competitor options when Tilda renders select values before labels", () => {
    expect(normalizeScrapedOptionGroups([
      {
        name: "Цвет",
        labels: [],
        selectOptions: ["Black", "White", "Cobalt Violet", "Sky Blue"],
      },
      {
        name: "Память",
        labels: ["12/256Gb", "12/512Gb", "16/1Tb"],
        selectOptions: ["12/256Gb", "12/512Gb", "16/1Tb"],
      },
    ])).toEqual([
      { name: "Цвет", values: ["Black", "White", "Cobalt Violet", "Sky Blue"] },
      { name: "Память", values: ["12/256Gb", "12/512Gb", "16/1Tb"] },
    ]);
  });

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

  it("fixes iPhone 17 Sage color and keeps remaining sim and storage options", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-4a",
        name: "iPhone 17, Sage",
        slug: "iphone-17-sage",
        sku: "PRO-0179",
        brand: "Apple",
        price: 64700,
        options: null,
      },
      {
        url: "https://resale52.ru/iphone/iphone-17/iphone-17",
        title: "iPhone 17",
        basePrice: 62990,
        groups: [
          { name: "Версия Sim", values: ["Esim", "Sim + Esim"] },
          { name: "Память", values: ["256Gb", "512Gb"] },
          { name: "Цвет", values: ["Mist Blue", "White", "Sage", "Black", "Lavender"] },
        ],
        variants: [
          { selections: { "Версия Sim": "Esim", "Память": "256Gb", "Цвет": "Mist Blue" }, price: 62990 },
          { selections: { "Версия Sim": "Esim", "Память": "512Gb", "Цвет": "Mist Blue" }, price: 74990 },
          { selections: { "Версия Sim": "Sim + Esim", "Память": "256Gb", "Цвет": "Mist Blue" }, price: 63990 },
          { selections: { "Версия Sim": "Sim + Esim", "Память": "512Gb", "Цвет": "Mist Blue" }, price: 75990 },
          { selections: { "Версия Sim": "Esim", "Память": "256Gb", "Цвет": "Sage" }, price: 62990 },
          { selections: { "Версия Sim": "Esim", "Память": "512Gb", "Цвет": "Sage" }, price: 74990 },
          { selections: { "Версия Sim": "Sim + Esim", "Память": "256Gb", "Цвет": "Sage" }, price: 63990 },
          { selections: { "Версия Sim": "Sim + Esim", "Память": "512Gb", "Цвет": "Sage" }, price: 75990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Sage.");
    expect(proposal.proposedOptions).toEqual({
      groups: [
        { name: "Версия Sim", values: ["Esim", "Sim + Esim"] },
        { name: "Память", values: ["256Gb", "512Gb"] },
      ],
      allVariants: true,
      variants: [
        { name: "Esim + 256Gb", price: 64700 },
        { name: "Esim + 512Gb", price: 76700 },
        { name: "Sim + Esim + 256Gb", price: 65700 },
        { name: "Sim + Esim + 512Gb", price: 77700 },
      ],
    });
  });

  it("fixes iPad Air 11 M3 color and leaves size and storage options", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-4b",
        name: 'iPad Air 11" m3 (2025), Серый',
        slug: "ipad-air-11-m3-2025-seryy",
        sku: "PRO-0061",
        brand: "Apple",
        price: 52700,
        options: null,
      },
      {
        url: "https://resale52.ru/tablet/apple-ipad/apple-ipad-air-m3-2025",
        title: "Apple iPad Air M3 (2025)",
        basePrice: 49990,
        groups: [
          { name: "Цвет", values: ["Blue", "Space Gray", "Starlight", "Purple"] },
          { name: "Память", values: ["128Gb", "256Gb", "512Gb"] },
          { name: "Размер", values: ['11"', '13"'] },
        ],
        variants: [
          { selections: { "Цвет": "Space Gray", "Память": "128Gb", "Размер": '11"' }, price: 49990 },
          { selections: { "Цвет": "Space Gray", "Память": "256Gb", "Размер": '11"' }, price: 57990 },
          { selections: { "Цвет": "Space Gray", "Память": "512Gb", "Размер": '11"' }, price: 69990 },
          { selections: { "Цвет": "Space Gray", "Память": "128Gb", "Размер": '13"' }, price: 64990 },
          { selections: { "Цвет": "Space Gray", "Память": "256Gb", "Размер": '13"' }, price: 72990 },
          { selections: { "Цвет": "Space Gray", "Память": "512Gb", "Размер": '13"' }, price: 84990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe('Зафиксированы опции: Цвет: Space Gray, Размер: 11".');
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["128Gb", "256Gb", "512Gb"] }],
      allVariants: true,
      variants: [
        { name: "128Gb", price: 51700 },
        { name: "256Gb", price: 59700 },
        { name: "512Gb", price: 71700 },
      ],
    });
  });

  it("fixes Samsung S26 Ultra cobalt violet color from Russian purple product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-13",
        name: "Samsung Galaxy S26 Ultra, Фиолетовый",
        slug: "samsung-galaxy-s26-ultra-фиолетовый",
        sku: "PRO-0261",
        brand: "Samsung",
        price: 86700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-s-26-ultra",
        title: "Samsung S26 Ultra",
        basePrice: 82990,
        groups: [
          { name: "Цвет", values: ["Black", "White", "Cobalt Violet", "Sky Blue"] },
          { name: "Память", values: ["12/256Gb", "12/512Gb", "16/1Tb"] },
        ],
        variants: [
          { selections: { "Цвет": "Black", "Память": "12/256Gb" }, price: 82990 },
          { selections: { "Цвет": "Black", "Память": "12/512Gb" }, price: 90990 },
          { selections: { "Цвет": "Black", "Память": "16/1Tb" }, price: 108990 },
          { selections: { "Цвет": "White", "Память": "12/256Gb" }, price: 82990 },
          { selections: { "Цвет": "White", "Память": "12/512Gb" }, price: 90990 },
          { selections: { "Цвет": "White", "Память": "16/1Tb" }, price: 108990 },
          { selections: { "Цвет": "Cobalt Violet", "Память": "12/256Gb" }, price: 82990 },
          { selections: { "Цвет": "Cobalt Violet", "Память": "12/512Gb" }, price: 90990 },
          { selections: { "Цвет": "Cobalt Violet", "Память": "16/1Tb" }, price: 108990 },
          { selections: { "Цвет": "Sky Blue", "Память": "12/256Gb" }, price: 82990 },
          { selections: { "Цвет": "Sky Blue", "Память": "12/512Gb" }, price: 90990 },
          { selections: { "Цвет": "Sky Blue", "Память": "16/1Tb" }, price: 108990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Cobalt Violet.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["12/256Gb", "12/512Gb", "16/1Tb"] }],
      allVariants: true,
      variants: [
        { name: "12/256Gb", price: 84700 },
        { name: "12/512Gb", price: 92700 },
        { name: "16/1Tb", price: 110700 },
      ],
    });
  });

  it("fixes Samsung Z Fold 7 gray titan color from transliterated gray product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-14",
        name: "Samsung Galaxy Z Fold 7, Серый",
        slug: "samsung-galaxy-z-fold-7-seryy",
        sku: "PRO-0073",
        brand: "Samsung",
        price: 110700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-z-fold-7",
        title: "Samsung Galaxy Z Fold 7",
        basePrice: 119990,
        groups: [
          { name: "Цвет", values: ["Синий", "Черный", "Серый Титан"] },
          { name: "Память", values: ["12/256Gb", "12/512Gb", "16/1Tb"] },
        ],
        variants: [
          { selections: { "Цвет": "Синий", "Память": "12/256Gb" }, price: 119990 },
          { selections: { "Цвет": "Синий", "Память": "12/512Gb" }, price: 134990 },
          { selections: { "Цвет": "Синий", "Память": "16/1Tb" }, price: 159990 },
          { selections: { "Цвет": "Черный", "Память": "12/256Gb" }, price: 119990 },
          { selections: { "Цвет": "Черный", "Память": "12/512Gb" }, price: 134990 },
          { selections: { "Цвет": "Черный", "Память": "16/1Tb" }, price: 159990 },
          { selections: { "Цвет": "Серый Титан", "Память": "12/256Gb" }, price: 119990 },
          { selections: { "Цвет": "Серый Титан", "Память": "12/512Gb" }, price: 134990 },
          { selections: { "Цвет": "Серый Титан", "Память": "16/1Tb" }, price: 159990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Серый Титан.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["12/256Gb", "12/512Gb", "16/1Tb"] }],
      allVariants: true,
      variants: [
        { name: "12/256Gb", price: 121700 },
        { name: "12/512Gb", price: 136700 },
        { name: "16/1Tb", price: 161700 },
      ],
    });
  });

  it("fixes Samsung Z Flip 7 coral color from transliterated coral product slug", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-15",
        name: "Samsung Galaxy Z Flip 7, Коралловый",
        slug: "samsung-galaxy-z-flip-7-korallovyy",
        sku: "PRO-0164",
        brand: "Samsung",
        price: 69700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-z-flip-7",
        title: "Samsung Galaxy Z Flip 7",
        basePrice: 69990,
        groups: [
          { name: "Цвет", values: ["Черный", "Коралловый", "Синий"] },
          { name: "Память", values: ["12/256Gb", "12/512Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Черный", "Память": "12/256Gb" }, price: 69990 },
          { selections: { "Цвет": "Черный", "Память": "12/512Gb" }, price: 79990 },
          { selections: { "Цвет": "Коралловый", "Память": "12/256Gb" }, price: 69990 },
          { selections: { "Цвет": "Коралловый", "Память": "12/512Gb" }, price: 79990 },
          { selections: { "Цвет": "Синий", "Память": "12/256Gb" }, price: 69990 },
          { selections: { "Цвет": "Синий", "Память": "12/512Gb" }, price: 79990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Коралловый.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["12/256Gb", "12/512Gb"] }],
      allVariants: true,
      variants: [
        { name: "12/256Gb", price: 71700 },
        { name: "12/512Gb", price: 81700 },
      ],
    });
  });

  it("fixes Samsung S25 Edge gray competitor color from local silver product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-16",
        name: "Samsung Galaxy S25 Edge, Серебристый",
        slug: "samsung-galaxy-s25-edge-serebristyy",
        sku: "PRO-0041",
        brand: "Samsung",
        price: 52700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-s25-edge",
        title: "Samsung Galaxy S25 Edge",
        basePrice: 49990,
        groups: [
          { name: "Цвет", values: ["Серый", "Голубой", "Черный"] },
          { name: "Память", values: ["12/256Gb", "12/512Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Серый", "Память": "12/256Gb" }, price: 49990 },
          { selections: { "Цвет": "Серый", "Память": "12/512Gb" }, price: 59990 },
          { selections: { "Цвет": "Голубой", "Память": "12/256Gb" }, price: 49990 },
          { selections: { "Цвет": "Голубой", "Память": "12/512Gb" }, price: 59990 },
          { selections: { "Цвет": "Черный", "Память": "12/256Gb" }, price: 49990 },
          { selections: { "Цвет": "Черный", "Память": "12/512Gb" }, price: 59990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Серый.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["12/256Gb", "12/512Gb"] }],
      allVariants: true,
      variants: [
        { name: "12/256Gb", price: 51700 },
        { name: "12/512Gb", price: 61700 },
      ],
    });
  });

  it("fixes Samsung A57 purple competitor color from local pink product name when pink is absent", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-17",
        name: "Samsung Galaxy A57, Розовый",
        slug: "samsung-galaxy-a57-rozovyy",
        sku: "PRO-0048",
        brand: "Samsung",
        price: 42700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-a57",
        title: "Samsung Galaxy A57",
        basePrice: 39990,
        groups: [
          { name: "Цвет", values: ["Синий", "Голубой", "Серый", "Фиолетовый"] },
          { name: "Память", values: ["8/128Gb", "8/256Gb", "12/512Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Синий", "Память": "8/128Gb" }, price: 39990 },
          { selections: { "Цвет": "Синий", "Память": "8/256Gb" }, price: 44990 },
          { selections: { "Цвет": "Синий", "Память": "12/512Gb" }, price: 54990 },
          { selections: { "Цвет": "Голубой", "Память": "8/128Gb" }, price: 39990 },
          { selections: { "Цвет": "Голубой", "Память": "8/256Gb" }, price: 44990 },
          { selections: { "Цвет": "Голубой", "Память": "12/512Gb" }, price: 54990 },
          { selections: { "Цвет": "Серый", "Память": "8/128Gb" }, price: 39990 },
          { selections: { "Цвет": "Серый", "Память": "8/256Gb" }, price: 44990 },
          { selections: { "Цвет": "Серый", "Память": "12/512Gb" }, price: 54990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/128Gb" }, price: 39990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/256Gb" }, price: 44990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "12/512Gb" }, price: 54990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Фиолетовый.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/128Gb", "8/256Gb", "12/512Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/128Gb", price: 41700 },
        { name: "8/256Gb", price: 46700 },
        { name: "12/512Gb", price: 56700 },
      ],
    });
  });

  it("fixes Samsung A56 light gray competitor color from local gray product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-18",
        name: "Samsung Galaxy A56, серый",
        slug: "samsung-galaxy-a56-seryy",
        sku: "PRO-0026",
        brand: "Samsung",
        price: 26700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-a56",
        title: "Samsung Galaxy A56",
        basePrice: 24990,
        groups: [
          { name: "Цвет", values: ["Graphite", "Light Gray", "Olive", "Pink"] },
          { name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Graphite", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Graphite", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Graphite", "Память": "12/256Gb" }, price: 30990 },
          { selections: { "Цвет": "Light Gray", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Light Gray", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Light Gray", "Память": "12/256Gb" }, price: 30990 },
          { selections: { "Цвет": "Olive", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Olive", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Olive", "Память": "12/256Gb" }, price: 30990 },
          { selections: { "Цвет": "Pink", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Pink", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Pink", "Память": "12/256Gb" }, price: 30990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Light Gray.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/128Gb", price: 26700 },
        { name: "8/256Gb", price: 29700 },
        { name: "12/256Gb", price: 32700 },
      ],
    });
  });

  it("fixes Samsung A56 olive competitor color from local green product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-19",
        name: "Samsung Galaxy A56, зеленый",
        slug: "samsung-galaxy-a56-zelenyy",
        sku: "PRO-0024",
        brand: "Samsung",
        price: 26700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-a56",
        title: "Samsung Galaxy A56",
        basePrice: 24990,
        groups: [
          { name: "Цвет", values: ["Graphite", "Light Gray", "Olive", "Pink"] },
          { name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Graphite", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Graphite", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Graphite", "Память": "12/256Gb" }, price: 30990 },
          { selections: { "Цвет": "Light Gray", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Light Gray", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Light Gray", "Память": "12/256Gb" }, price: 30990 },
          { selections: { "Цвет": "Olive", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Olive", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Olive", "Память": "12/256Gb" }, price: 30990 },
          { selections: { "Цвет": "Pink", "Память": "8/128Gb" }, price: 24990 },
          { selections: { "Цвет": "Pink", "Память": "8/256Gb" }, price: 27990 },
          { selections: { "Цвет": "Pink", "Память": "12/256Gb" }, price: 30990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Olive.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/128Gb", price: 26700 },
        { name: "8/256Gb", price: 29700 },
        { name: "12/256Gb", price: 32700 },
      ],
    });
  });

  it("fixes Samsung A37 purple competitor color from local lavender product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-20",
        name: "Samsung Galaxy A37, Лавандовый",
        slug: "samsung-galaxy-a37-lavandovyy",
        sku: "PRO-0323",
        brand: "Samsung",
        price: 27700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-a37",
        title: "Samsung Galaxy A37",
        basePrice: 25990,
        groups: [
          { name: "Цвет", values: ["Черный", "Белый", "Зеленый", "Фиолетовый"] },
          { name: "Память", values: ["8/128Gb", "8/256Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Черный", "Память": "8/128Gb" }, price: 25990 },
          { selections: { "Цвет": "Черный", "Память": "8/256Gb" }, price: 29990 },
          { selections: { "Цвет": "Белый", "Память": "8/128Gb" }, price: 25990 },
          { selections: { "Цвет": "Белый", "Память": "8/256Gb" }, price: 29990 },
          { selections: { "Цвет": "Зеленый", "Память": "8/128Gb" }, price: 25990 },
          { selections: { "Цвет": "Зеленый", "Память": "8/256Gb" }, price: 29990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/128Gb" }, price: 25990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/256Gb" }, price: 29990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Фиолетовый.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/128Gb", "8/256Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/128Gb", price: 27700 },
        { name: "8/256Gb", price: 31700 },
      ],
    });
  });

  it("fixes Samsung A36 purple competitor color from local lavender product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-21",
        name: "Samsung Galaxy A36, лавандовый",
        slug: "samsung-galaxy-a36-lavandovyy",
        sku: "PRO-0020",
        brand: "Samsung",
        price: 20700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-a36",
        title: "Samsung Galaxy A36",
        basePrice: 18990,
        groups: [
          { name: "Цвет", values: ["Белый", "Черный", "Зеленый", "Фиолетовый"] },
          { name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Белый", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Белый", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Белый", "Память": "12/256Gb" }, price: 24990 },
          { selections: { "Цвет": "Черный", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Черный", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Черный", "Память": "12/256Gb" }, price: 24990 },
          { selections: { "Цвет": "Зеленый", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Зеленый", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Зеленый", "Память": "12/256Gb" }, price: 24990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "12/256Gb" }, price: 24990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Фиолетовый.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/128Gb", price: 20700 },
        { name: "8/256Gb", price: 23700 },
        { name: "12/256Gb", price: 26700 },
      ],
    });
  });

  it("fixes Samsung A36 green competitor color from local lime product name", () => {
    const proposal = buildProposalForProduct(
      {
        id: "product-22",
        name: "Samsung Galaxy A36, лаймовый",
        slug: "samsung-galaxy-a36-laymovyy",
        sku: "PRO-0021",
        brand: "Samsung",
        price: 20700,
        options: null,
      },
      {
        url: "https://resale52.ru/android/samsung/samsung-a36",
        title: "Samsung Galaxy A36",
        basePrice: 18990,
        groups: [
          { name: "Цвет", values: ["Белый", "Черный", "Зеленый", "Фиолетовый"] },
          { name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] },
        ],
        variants: [
          { selections: { "Цвет": "Белый", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Белый", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Белый", "Память": "12/256Gb" }, price: 24990 },
          { selections: { "Цвет": "Черный", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Черный", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Черный", "Память": "12/256Gb" }, price: 24990 },
          { selections: { "Цвет": "Зеленый", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Зеленый", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Зеленый", "Память": "12/256Gb" }, price: 24990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/128Gb" }, price: 18990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "8/256Gb" }, price: 21990 },
          { selections: { "Цвет": "Фиолетовый", "Память": "12/256Gb" }, price: 24990 },
        ],
      },
      "slug",
      "high",
    );

    expect(proposal.note).toBe("Зафиксированы опции: Цвет: Зеленый.");
    expect(proposal.proposedOptions).toEqual({
      groups: [{ name: "Память", values: ["8/128Gb", "8/256Gb", "12/256Gb"] }],
      allVariants: true,
      variants: [
        { name: "8/128Gb", price: 20700 },
        { name: "8/256Gb", price: 23700 },
        { name: "12/256Gb", price: 26700 },
      ],
    });
  });
});