import { describe, expect, it } from "vitest";
import {
  calculateTradeInQuote,
  calculateServiceQuote,
  getTradeInBrands,
  getTradeInModels,
  getServiceBrands,
  getServiceModels,
  getRepairTypes,
  getTradeInStorageOptions,
} from "../src/pricing";

describe("Trade-in pricing", () => {
  it("returns known brands", () => {
    const brands = getTradeInBrands();
    expect(brands).toContain("Apple");
    expect(brands).toContain("Samsung");
  });

  it("returns models for Apple", () => {
    const models = getTradeInModels("Apple");
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain("iPhone 15 Pro");
  });

  it("returns storage options", () => {
    const options = getTradeInStorageOptions("Apple", "iPhone 15 Pro");
    expect(options).toContain("256 ГБ");
  });

  it("calculates known quote", () => {
    const price = calculateTradeInQuote({
      brand: "Apple",
      model: "iPhone 15 Pro",
      storage: "256 ГБ",
      condition: "excellent",
    });
    expect(price).toBe(68000);
  });

  it("returns null for unknown combo", () => {
    const price = calculateTradeInQuote({
      brand: "Apple",
      model: "iPhone 99",
      storage: "1 TB",
      condition: "excellent",
    });
    expect(price).toBeNull();
  });
});

describe("Service pricing", () => {
  it("returns known brands", () => {
    const brands = getServiceBrands();
    expect(brands).toContain("Apple");
    expect(brands).toContain("Samsung");
  });

  it("returns models for Samsung", () => {
    const models = getServiceModels("Samsung");
    expect(models).toContain("Galaxy S24 Ultra");
  });

  it("returns repair types", () => {
    const types = getRepairTypes("Apple", "iPhone 15 Pro");
    expect(types).toContain("Замена экрана");
    expect(types).toContain("Замена батареи");
  });

  it("calculates known quote", () => {
    const price = calculateServiceQuote({
      brand: "Apple",
      model: "iPhone 15 Pro",
      repairType: "Замена экрана",
    });
    expect(price).toBe(24990);
  });

  it("returns null for unknown combo", () => {
    const price = calculateServiceQuote({
      brand: "Nokia",
      model: "3310",
      repairType: "Замена экрана",
    });
    expect(price).toBeNull();
  });
});
