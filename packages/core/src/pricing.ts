import { z } from "zod";

const tradeInRuleSchema = z.object({
  brand: z.string(),
  model: z.string(),
  storage: z.string().optional(),
  condition: z.enum(["excellent", "good", "fair"]),
  price: z.number().positive(),
});

const servicePriceRowSchema = z.object({
  brand: z.string(),
  model: z.string(),
  repairType: z.string(),
  price: z.number().positive(),
});

export const tradeInRules = tradeInRuleSchema.array().parse([
  { brand: "Apple", model: "iPhone 15 Pro", storage: "256 ГБ", condition: "excellent", price: 68000 },
  { brand: "Apple", model: "iPhone 15 Pro", storage: "256 ГБ", condition: "good", price: 61000 },
  { brand: "Apple", model: "iPhone 15 Pro", storage: "256 ГБ", condition: "fair", price: 54000 },
  { brand: "Apple", model: "iPhone 14", storage: "128 ГБ", condition: "excellent", price: 47000 },
  { brand: "Apple", model: "iPhone 14", storage: "128 ГБ", condition: "good", price: 42000 },
  { brand: "Apple", model: "iPhone 14", storage: "128 ГБ", condition: "fair", price: 36000 },
  { brand: "Samsung", model: "Galaxy S24 Ultra", storage: "256 ГБ", condition: "excellent", price: 59000 },
  { brand: "Samsung", model: "Galaxy S24 Ultra", storage: "256 ГБ", condition: "good", price: 53000 },
  { brand: "Samsung", model: "Galaxy S24 Ultra", storage: "256 ГБ", condition: "fair", price: 47000 },
  { brand: "Samsung", model: "Galaxy S23", storage: "256 ГБ", condition: "excellent", price: 34000 },
  { brand: "Samsung", model: "Galaxy S23", storage: "256 ГБ", condition: "good", price: 30000 },
  { brand: "Samsung", model: "Galaxy S23", storage: "256 ГБ", condition: "fair", price: 25000 },
]);

export const servicePriceRows = servicePriceRowSchema.array().parse([
  { brand: "Apple", model: "iPhone 15 Pro", repairType: "Замена экрана", price: 24990 },
  { brand: "Apple", model: "iPhone 15 Pro", repairType: "Замена батареи", price: 8990 },
  { brand: "Apple", model: "iPhone 15 Pro", repairType: "Замена камеры", price: 16990 },
  { brand: "Apple", model: "iPhone 14", repairType: "Замена экрана", price: 18990 },
  { brand: "Apple", model: "iPhone 14", repairType: "Замена батареи", price: 7490 },
  { brand: "Samsung", model: "Galaxy S24 Ultra", repairType: "Замена экрана", price: 23990 },
  { brand: "Samsung", model: "Galaxy S24 Ultra", repairType: "Замена батареи", price: 7990 },
  { brand: "Samsung", model: "Galaxy S23", repairType: "Замена экрана", price: 16990 },
  { brand: "Apple", model: "MacBook Air 13 M3", repairType: "Замена батареи", price: 15990 },
  { brand: "Apple", model: "MacBook Air 13 M3", repairType: "Чистка после залития", price: 6990 },
  { brand: "Apple", model: "iPad Pro 11 M4", repairType: "Замена экрана", price: 28990 },
  { brand: "Apple", model: "iPad Pro 11 M4", repairType: "Замена порта", price: 9990 },
]);

export type TradeInRule = (typeof tradeInRules)[number];
export type ServicePriceRow = (typeof servicePriceRows)[number];
export type TradeInCondition = TradeInRule["condition"];

export const tradeInConditions: Array<{ value: TradeInCondition; label: string }> = [
  { value: "excellent", label: "Отличное состояние" },
  { value: "good", label: "Хорошее состояние" },
  { value: "fair", label: "Есть заметные следы использования" },
];

export function getTradeInBrands() {
  return [...new Set(tradeInRules.map((item) => item.brand))];
}

export function getTradeInModels(brand: string) {
  return [...new Set(tradeInRules.filter((item) => item.brand === brand).map((item) => item.model))];
}

export function getTradeInStorageOptions(brand: string, model: string) {
  return [
    ...new Set(
      tradeInRules
        .filter((item) => item.brand === brand && item.model === model)
        .map((item) => item.storage)
        .filter((item): item is string => Boolean(item)),
    ),
  ];
}

export function calculateTradeInQuote(input: {
  brand: string;
  model: string;
  storage?: string;
  condition: TradeInCondition;
}) {
  return (
    tradeInRules.find(
      (item) =>
        item.brand === input.brand &&
        item.model === input.model &&
        item.storage === input.storage &&
        item.condition === input.condition,
    )?.price ?? null
  );
}

export function getServiceBrands() {
  return [...new Set(servicePriceRows.map((item) => item.brand))];
}

export function getServiceModels(brand: string) {
  return [...new Set(servicePriceRows.filter((item) => item.brand === brand).map((item) => item.model))];
}

export function getRepairTypes(brand: string, model: string) {
  return [
    ...new Set(
      servicePriceRows
        .filter((item) => item.brand === brand && item.model === model)
        .map((item) => item.repairType),
    ),
  ];
}

export function calculateServiceQuote(input: { brand: string; model: string; repairType: string }) {
  return (
    servicePriceRows.find(
      (item) =>
        item.brand === input.brand && item.model === input.model && item.repairType === input.repairType,
    )?.price ?? null
  );
}