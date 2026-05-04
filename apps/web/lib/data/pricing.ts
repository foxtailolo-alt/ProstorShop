import {
  servicePriceRows,
  tradeInRules,
  type ServicePriceRow,
  type TradeInCondition,
  type TradeInRule,
} from "@prostor/core";
import { prisma } from "@prostor/db";
import { getCompetitorSyncScopeDefinition } from "../competitor-sync-scopes";
import { buildFallbackServiceCatalogEntries, type ServiceCatalogEntry } from "../service-catalog";
import { type TradeInSnapshotGraph } from "../trade-in-snapshot";
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

export async function listTradeInSnapshots() {
  const snapshots = await safeQuery(() =>
    prisma.tradeInSnapshot.findMany({
      orderBy: { version: "desc" },
      take: 10,
      include: {
        categories: {
          include: {
            models: true,
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    }),
  );

  return snapshots ?? [];
}

export async function getActiveTradeInSnapshot() {
  const snapshot = await safeQuery(() =>
    prisma.tradeInSnapshot.findFirst({
      where: { status: "active" },
      orderBy: { version: "desc" },
      include: {
        categories: {
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          include: {
            models: {
              orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
            },
            questions: {
              orderBy: [{ stepIndex: "asc" }, { title: "asc" }],
              include: {
                options: {
                  orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
                },
              },
            },
          },
        },
      },
    }),
  );

  if (!snapshot) {
    return null as TradeInSnapshotGraph | null;
  }

  return {
    id: snapshot.id,
    version: snapshot.version,
    sourceName: snapshot.sourceName,
    pricingCity: snapshot.pricingCity,
    status: snapshot.status,
    importedAt: snapshot.importedAt ?? snapshot.createdAt,
    categories: snapshot.categories.map((category) => ({
      id: category.id,
      categoryCode: category.categoryCode as TradeInSnapshotGraph["categories"][number]["categoryCode"],
      title: category.title,
      sortOrder: category.sortOrder,
      isEnabled: category.isEnabled,
      models: category.models.map((model) => ({
        id: model.id,
        code: model.code,
        title: model.title,
        metadata: model.metadata && typeof model.metadata === "object" && !Array.isArray(model.metadata)
          ? (model.metadata as Record<string, unknown>)
          : {},
        sortOrder: model.sortOrder,
        isEnabled: model.isEnabled,
      })),
      questions: category.questions.map((question) => ({
        id: question.id,
        code: question.code,
        title: question.title,
        stepIndex: question.stepIndex,
        questionKind: question.questionKind,
        branchingRules: question.branchingRules && typeof question.branchingRules === "object" && !Array.isArray(question.branchingRules)
          ? (question.branchingRules as Record<string, unknown>)
          : {},
        isRequired: question.isRequired,
        options: question.options.map((option) => ({
          id: option.id,
          code: option.code,
          title: option.title,
          pricingPayload: option.pricingPayload && typeof option.pricingPayload === "object" && !Array.isArray(option.pricingPayload)
            ? (option.pricingPayload as Record<string, unknown>)
            : {},
          sortOrder: option.sortOrder,
          isEnabled: option.isEnabled,
        })),
      })),
    })),
  } satisfies TradeInSnapshotGraph;
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

export async function listServiceCatalogEntries() {
  const services = await safeQuery(() =>
    prisma.serviceCatalogService.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        models: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "desc" }, { name: "asc" }],
          include: {
            variants: {
              where: { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            },
          },
        },
      },
    }),
  );

  if (!services) {
    return buildFallbackServiceCatalogEntries();
  }

  const entries: ServiceCatalogEntry[] = [];

  for (const service of services) {
    for (const model of service.models) {
      for (const variant of model.variants) {
        entries.push({
          serviceId: service.id,
          modelId: model.id,
          variantId: variant.id,
          serviceSlug: service.slug,
          serviceName: service.name,
          serviceDescription: service.description,
          modelName: model.name,
          modelSlug: model.slug,
          brand: model.brand,
          variantName: variant.name,
          variantSlug: variant.slug,
          variantDescription: variant.description,
          sourceKinds: Array.isArray(variant.sourceKinds) ? variant.sourceKinds.filter((item): item is string => typeof item === "string") : [],
          metadata: variant.metadata && typeof variant.metadata === "object" && !Array.isArray(variant.metadata)
            ? (variant.metadata as Record<string, unknown>)
            : {},
          partPrice: Number(variant.partPrice),
          laborPrice: Number(variant.laborPrice),
          totalPrice: Number(variant.totalPrice),
          currency: variant.currency,
          sourceFile: variant.sourceFile,
          sourceLabel: variant.sourceLabel,
          serviceSortOrder: service.sortOrder,
          modelSortOrder: model.sortOrder,
          variantSortOrder: variant.sortOrder,
        });
      }
    }
  }

  return entries;
}

export async function listServiceCatalogImports() {
  const logs = await safeQuery(() =>
    prisma.serviceCatalogImportLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  );

  return logs ?? [];
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