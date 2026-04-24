import {
  servicePriceRows,
  tradeInRules,
  type ServicePriceRow,
  type TradeInCondition,
  type TradeInRule,
} from "@prostor/core";
import { prisma } from "@prostor/db";
import { getCompetitorSyncScopeDefinition } from "../competitor-sync-scopes";
import { findNodeBySlug, getAllCategorySlugs, loadCategoryTree } from "./catalog";

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

export async function listCompetitorPriceSyncRuns() {
  const runs = await safeQuery(() =>
    prisma.competitorPriceSyncRun.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { rows: true },
        },
      },
      take: 20,
    }),
  );

  return runs ?? [];
}

export async function getCompetitorPriceSyncRun(runId?: string | null) {
  if (!runId) {
    return null;
  }

  return safeQuery(() =>
    prisma.competitorPriceSyncRun.findUnique({
      where: { id: runId },
      include: {
        rows: {
          orderBy: [
            { status: "asc" },
            { matchConfidence: "desc" },
            { updatedAt: "desc" },
          ],
          include: {
            product: {
              include: {
                category: {
                  select: { name: true, slug: true },
                },
              },
            },
          },
        },
      },
    }),
  );
}

export type CompetitorSyncCategoryProgressItem = {
  categorySlug: string;
  categoryName: string;
  totalCount: number;
  processedCount: number;
  status: "pending" | "in-progress" | "completed";
};

export async function getCompetitorSyncCategoryProgress(runId?: string | null) {
  if (!runId) {
    return [] as CompetitorSyncCategoryProgressItem[];
  }

  const [run, categoryTree] = await Promise.all([
    safeQuery(() =>
      prisma.competitorPriceSyncRun.findUnique({
        where: { id: runId },
        select: { scope: true },
      }),
    ),
    loadCategoryTree(),
  ]);

  const scopeDefinition = getCompetitorSyncScopeDefinition(run?.scope);
  const scopeNode = scopeDefinition.categorySlug ? findNodeBySlug(categoryTree, scopeDefinition.categorySlug) : null;
  const scopeCategorySlugs = scopeNode ? getAllCategorySlugs([scopeNode]) : [];

  const [products, rows] = await Promise.all([
    safeQuery(() =>
      prisma.product.findMany({
        where: {
          brand: { in: ["Apple", "Samsung"] },
          ...(scopeCategorySlugs.length > 0 ? { category: { slug: { in: scopeCategorySlugs } } } : {}),
        },
        select: {
          category: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      }),
    ),
    safeQuery(() =>
      prisma.competitorPriceReviewRow.findMany({
        where: { syncRunId: runId },
        select: {
          product: {
            select: {
              category: {
                select: {
                  slug: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ),
  ]);

  const totalByCategory = new Map<string, CompetitorSyncCategoryProgressItem>();

  for (const product of products ?? []) {
    const slug = product.category.slug;
    const current = totalByCategory.get(slug);
    if (current) {
      current.totalCount += 1;
      continue;
    }

    totalByCategory.set(slug, {
      categorySlug: slug,
      categoryName: product.category.name,
      totalCount: 1,
      processedCount: 0,
      status: "pending",
    });
  }

  for (const row of rows ?? []) {
    const slug = row.product.category.slug;
    const current = totalByCategory.get(slug);
    if (!current) {
      totalByCategory.set(slug, {
        categorySlug: slug,
        categoryName: row.product.category.name,
        totalCount: 0,
        processedCount: 1,
        status: "completed",
      });
      continue;
    }

    current.processedCount += 1;
  }

  const statusWeight = {
    "in-progress": 0,
    pending: 1,
    completed: 2,
  } as const;

  return [...totalByCategory.values()]
    .map((item) => {
      const status: CompetitorSyncCategoryProgressItem["status"] =
        item.processedCount <= 0
          ? "pending"
          : item.processedCount >= item.totalCount
            ? "completed"
            : "in-progress";

      return {
        ...item,
        status,
      } satisfies CompetitorSyncCategoryProgressItem;
    })
    .sort((left, right) => {
      const statusDiff = statusWeight[left.status] - statusWeight[right.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return left.categoryName.localeCompare(right.categoryName, "ru-RU");
    });
}