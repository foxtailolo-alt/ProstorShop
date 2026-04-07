import {
  servicePriceRows,
  tradeInRules,
  type ServicePriceRow,
  type TradeInCondition,
  type TradeInRule,
} from "@prostor/core";
import { prisma } from "@prostor/db";

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function safeQuery<T>(query: () => Promise<T>) {
  if (!databaseConfigured()) {
    return null;
  }

  try {
    return await query();
  } catch {
    return null;
  }
}

export async function listTradeInRules() {
  const dbRules = await safeQuery(() =>
    prisma.tradeInRule.findMany({
      where: { isActive: true },
      orderBy: [{ brand: "asc" }, { model: "asc" }, { price: "desc" }],
    }),
  );

  if (!dbRules) {
    return tradeInRules;
  }

  return dbRules.map<TradeInRule>((rule) => ({
    brand: rule.brand,
    model: rule.model,
    storage: rule.storage ?? undefined,
    condition: rule.condition as TradeInCondition,
    price: Number(rule.price),
  }));
}

export async function listServicePriceRows() {
  const activeTable = await safeQuery(() =>
    prisma.servicePriceTable.findFirst({
      where: { isActive: true },
      include: { rows: true },
      orderBy: { version: "desc" },
    }),
  );

  if (!activeTable) {
    return servicePriceRows;
  }

  return activeTable.rows.map<ServicePriceRow>((row) => ({
    brand: row.brand,
    model: row.model,
    repairType: row.repairType,
    price: Number(row.price),
  }));
}

export async function listServicePriceVersions() {
  const tables = await safeQuery(() =>
    prisma.servicePriceTable.findMany({
      orderBy: { version: "desc" },
      include: {
        _count: {
          select: { rows: true },
        },
      },
    }),
  );

  return tables ?? [];
}