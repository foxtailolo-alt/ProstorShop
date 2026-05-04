import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseServiceCatalogWorkbook } from "./service-catalog";

function buildWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();

  const batteryRows = [
    ["header"],
    ["header"],
    [
      "Аккумулятор iPhone 15 Pro Оригинал",
      4500,
      3000,
      7300,
      "",
      "Аккумулятор iPhone 15 Pro Premium Clean 100%",
      2500,
      2000,
      4100,
    ],
  ];

  const coverRows = [
    ["header"],
    ["header"],
    [
      "Задняя крышка (стекло) iPhone 14 Pro (Фиолетовый)",
      2000,
      1500,
      3200,
      "",
      "",
      "",
      "",
      "",
      "",
      "Задняя крышка (стекло) iPhone 14 Pro Оригинал",
      6000,
      1500,
      7700,
    ],
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(batteryRows), "Прайс АКБ");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(coverRows), "Прайс Крышки (копия)");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("service catalog import", () => {
  it("normalizes RepairProstorBot Excel sheets into service catalog records", () => {
    const parsed = parseServiceCatalogWorkbook(buildWorkbookBuffer(), "Ремонт.xlsx");

    expect(parsed.rowsRead).toBe(4);
    expect(parsed.normalizedRows).toBe(4);
    expect(parsed.warnings).toEqual([]);

    expect(parsed.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          brand: "Apple",
          modelName: "iPhone 15 Pro",
          serviceSlug: "battery-replacement",
          variantName: "Оригинал",
          totalPrice: 7500,
        }),
        expect.objectContaining({
          brand: "Apple",
          modelName: "iPhone 15 Pro",
          serviceSlug: "battery-replacement",
          variantName: "Премиум копия",
          totalPrice: 4500,
        }),
        expect.objectContaining({
          brand: "Apple",
          modelName: "iPhone 14 Pro",
          serviceSlug: "back-cover-replacement",
          variantName: "Копия",
          totalPrice: 3500,
          metadata: { colors: ["Фиолетовый"] },
        }),
        expect.objectContaining({
          brand: "Apple",
          modelName: "iPhone 14 Pro",
          serviceSlug: "back-cover-replacement",
          variantName: "Оригинал",
          totalPrice: 8000,
        }),
      ]),
    );

    const coverCopy = parsed.records.find(
      (record) => record.serviceSlug === "back-cover-replacement" && record.variantName === "Копия",
    );

    expect(coverCopy?.variantDescription).toContain("неизвестная деталь");
  });
});