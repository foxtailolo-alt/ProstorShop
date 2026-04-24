"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prostor/db";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { findNodeBySlug, getAllCategorySlugs, loadCategoryTree } from "../../../../lib/data/catalog";
import {
  buildProposalForProduct,
  fetchCompetitorSitemapUrls,
  matchCompetitorUrlForProduct,
  scrapeCompetitorProduct,
  withCompetitorBrowser,
} from "../../../../lib/competitor-sync";
import { getCompetitorSyncScopeDefinition } from "../../../../lib/competitor-sync-scopes";

const SUPPORTED_BRANDS = ["Apple", "Samsung"] as const;

function toNullableJsonValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return undefined;
  }

  return value;
}

async function updateSyncRunProgress(
  runId: string,
  data: {
    matchedCount?: number;
    unmatchedCount?: number;
    skippedCount?: number;
    note?: string | null;
    status?: string;
    finishedAt?: Date | null;
  },
) {
  await prisma.competitorPriceSyncRun.update({
    where: { id: runId },
    data,
  });
}

function buildCompetitorPricingRedirectUrl(runId: string, category?: string | null) {
  const query = new URLSearchParams({
    run: runId,
  });

  if (category?.trim()) {
    query.set("category", category.trim());
  }

  return `/admin/competitor-pricing?${query.toString()}`;
}

async function processCompetitorPriceSyncRun(runId: string) {
  let matchedCount = 0;
  let unmatchedCount = 0;
  let skippedCount = 0;

  try {
    const [run, categoryTree, sitemapUrls] = await Promise.all([
      prisma.competitorPriceSyncRun.findUnique({ where: { id: runId } }),
      loadCategoryTree(),
      fetchCompetitorSitemapUrls(),
    ]);

    if (!run) {
      throw new Error("Sync run не найден.");
    }

    const scopeDefinition = getCompetitorSyncScopeDefinition(run.scope);
    const scopeNode = scopeDefinition.categorySlug ? findNodeBySlug(categoryTree, scopeDefinition.categorySlug) : null;
    const scopeCategorySlugs = scopeNode ? getAllCategorySlugs([scopeNode]) : [];
    const products = await prisma.product.findMany({
      where: {
        brand: { in: [...SUPPORTED_BRANDS] },
        ...(scopeCategorySlugs.length > 0 ? { category: { slug: { in: scopeCategorySlugs } } } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        brand: true,
        price: true,
        options: true,
      },
    });

    const scrapedCache = new Map<string, Awaited<ReturnType<typeof scrapeCompetitorProduct>>>();

    await updateSyncRunProgress(runId, {
      note: `Подготовка к обработке ${products.length} товаров. Scope: ${scopeDefinition.label}.`,
    });

    await withCompetitorBrowser(async (browser) => {
      for (const [index, product] of products.entries()) {
        await updateSyncRunProgress(runId, {
          matchedCount,
          unmatchedCount,
          skippedCount,
          note: `[${index + 1}/${products.length}] ${product.name}`,
        });

        const matchedUrl = matchCompetitorUrlForProduct(
          {
            ...product,
            price: Number(product.price),
          },
          sitemapUrls,
        );

        if (!matchedUrl) {
          unmatchedCount += 1;
          await prisma.competitorPriceReviewRow.create({
            data: {
              syncRunId: runId,
              productId: product.id,
              status: "unmatched",
              matchConfidence: "none",
              matchMethod: "slug",
              competitorUrl: "",
              competitorProductName: product.name,
              competitorBrand: product.brand,
              competitorCategoryPath: null,
              currentBasePrice: Number(product.price),
              competitorBasePrice: Number(product.price),
              proposedBasePrice: Number(product.price),
              currentOptions: toNullableJsonValue(product.options),
              competitorOptions: undefined,
              proposedOptions: undefined,
              currentVariantCount: 0,
              proposedVariantCount: 0,
              note: "Не найдено совпадение в sitemap конкурента.",
            },
          });
          continue;
        }

        let scraped = scrapedCache.get(matchedUrl.url);
        if (!scraped) {
          scraped = await scrapeCompetitorProduct(browser, matchedUrl.url);
          scrapedCache.set(matchedUrl.url, scraped);
        }

        const proposal = buildProposalForProduct(
          {
            ...product,
            price: Number(product.price),
          },
          scraped,
          "slug",
          matchedUrl.score >= 100 ? "high" : matchedUrl.score >= 80 ? "medium" : "low",
        );

        matchedCount += 1;
        await prisma.competitorPriceReviewRow.create({
          data: {
            syncRunId: runId,
            productId: product.id,
            status: proposal.status,
            matchConfidence: proposal.matchConfidence,
            matchMethod: proposal.matchMethod,
            competitorUrl: proposal.competitorUrl,
            competitorProductName: proposal.competitorProductName,
            competitorBrand: proposal.competitorBrand,
            competitorCategoryPath: proposal.competitorCategoryPath,
            currentBasePrice: Number(product.price),
            competitorBasePrice: proposal.competitorBasePrice,
            proposedBasePrice: proposal.proposedBasePrice,
            currentOptions: toNullableJsonValue(product.options),
            competitorOptions: toNullableJsonValue(proposal.competitorOptions),
            proposedOptions: toNullableJsonValue(proposal.proposedOptions),
            currentVariantCount: proposal.currentVariantCount,
            proposedVariantCount: proposal.proposedVariantCount,
            note: proposal.note,
          },
        });
      }
    });

    await updateSyncRunProgress(runId, {
      status: "completed",
      matchedCount,
      unmatchedCount,
      skippedCount,
      finishedAt: new Date(),
      note: `Собрано ${matchedCount + unmatchedCount + skippedCount} строк.`,
    });

    await logAdminActivity({
      entityType: "competitor-price-sync-run",
      entityId: runId,
      action: "competitor.pricing.synced",
      summary: `Импортирован обзор цен конкурента для ${matchedCount + unmatchedCount + skippedCount} товаров.`,
      metadata: {
        source: run.source,
        matchedCount,
        unmatchedCount,
        skippedCount,
      },
    });
  } catch (error) {
    await updateSyncRunProgress(runId, {
      status: "failed",
      matchedCount,
      unmatchedCount,
      skippedCount,
      finishedAt: new Date(),
      note: error instanceof Error ? error.message : "Неизвестная ошибка синхронизации.",
    });
  }
}

export async function runCompetitorPriceSyncAction(formData: FormData) {
  const session = await requirePermission("products", "write");
  const scopeKey = getCompetitorSyncScopeDefinition(String(formData.get("scope") ?? "").trim() || null).key;
  const run = await prisma.competitorPriceSyncRun.create({
    data: {
      source: "resale52.ru",
      scope: scopeKey,
      status: "running",
      initiatedByUserId: session.user.id,
      startedAt: new Date(),
    },
  });

  void processCompetitorPriceSyncRun(run.id);

  revalidatePath("/admin/competitor-pricing");
  revalidatePath("/admin/products");
  revalidatePath("/admin/activity");

  redirect(`/admin/competitor-pricing?run=${encodeURIComponent(run.id)}`);
}

export async function applyCompetitorPriceSyncRunAction(formData: FormData) {
  await requirePermission("products", "write");
  const runId = String(formData.get("runId") ?? "").trim();

  if (!runId) {
    throw new Error("Не указан sync run.");
  }

  const run = await prisma.competitorPriceSyncRun.findUnique({
    where: { id: runId },
    include: {
      rows: {
        where: { status: "pending" },
      },
    },
  });

  if (!run) {
    throw new Error("Sync run не найден.");
  }

  await prisma.$transaction(async (transaction) => {
    for (const row of run.rows) {
      await transaction.product.update({
        where: { id: row.productId },
        data: {
          price: row.proposedBasePrice,
          options: toNullableJsonValue(row.proposedOptions),
        },
      });

      await transaction.competitorPriceReviewRow.update({
        where: { id: row.id },
        data: {
          status: "applied",
          appliedAt: new Date(),
        },
      });
    }

    await transaction.competitorPriceSyncRun.update({
      where: { id: run.id },
      data: {
        status: "applied",
        finishedAt: new Date(),
        note: `Применено ${run.rows.length} строк.`,
      },
    });
  });

  await logAdminActivity({
    entityType: "competitor-price-sync-run",
    entityId: run.id,
    action: "competitor.pricing.applied",
    summary: `Применены цены конкурента для ${run.rows.length} товаров.`,
    metadata: {
      source: run.source,
      rows: run.rows.length,
    },
  });

  revalidatePath("/admin/competitor-pricing");
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath("/");
  revalidatePath("/admin/activity");

  redirect(`/admin/competitor-pricing?run=${encodeURIComponent(run.id)}`);
}

export async function updateCompetitorPriceReviewRowAction(formData: FormData) {
  await requirePermission("products", "write");
  const rowId = String(formData.get("rowId") ?? "").trim();
  const runId = String(formData.get("runId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const proposedBasePrice = Number(formData.get("proposedBasePrice") ?? Number.NaN);

  if (!rowId || !runId || !Number.isFinite(proposedBasePrice) || proposedBasePrice <= 0) {
    throw new Error("Некорректные данные для обновления review row.");
  }

  const currentRow = await prisma.competitorPriceReviewRow.findUnique({
    where: { id: rowId },
    select: { proposedOptions: true },
  });

  if (!currentRow) {
    throw new Error("Review row не найдена.");
  }

  let nextProposedOptions = currentRow.proposedOptions;
  const variantNames = formData.getAll("variantName").map((value) => String(value).trim()).filter(Boolean);
  const variantPrices = formData.getAll("variantPrice").map((value) => Number(value));

  if (
    currentRow.proposedOptions
    && typeof currentRow.proposedOptions === "object"
    && !Array.isArray(currentRow.proposedOptions)
    && variantNames.length > 0
    && variantNames.length === variantPrices.length
  ) {
    const options = currentRow.proposedOptions as {
      groups?: Array<{ name: string; values: string[] }>;
      allVariants?: boolean;
      variants?: Array<{ name: string; price: number }>;
    };

    nextProposedOptions = {
      ...options,
      variants: variantNames.map((name, index) => ({
        name,
        price: Number.isFinite(variantPrices[index]) && variantPrices[index]! > 0
          ? Math.round(variantPrices[index]!)
          : 0,
      })),
    };
  }

  await prisma.competitorPriceReviewRow.update({
    where: { id: rowId },
    data: {
      proposedBasePrice,
      proposedOptions: toNullableJsonValue(nextProposedOptions),
      updatedAt: new Date(),
    },
  });

  await logAdminActivity({
    entityType: "competitor-price-review-row",
    entityId: rowId,
    action: "competitor.pricing.row.updated",
    summary: `Обновлена предложенная цена review row до ${proposedBasePrice}.`,
    metadata: { runId, proposedBasePrice },
  });

  const redirectUrl = buildCompetitorPricingRedirectUrl(runId, category);

  revalidatePath(redirectUrl);
  revalidatePath("/admin/competitor-pricing");
  redirect(redirectUrl as "/");
}

export async function applyCompetitorPriceReviewRowAction(formData: FormData) {
  await requirePermission("products", "write");
  const rowId = String(formData.get("rowId") ?? "").trim();
  const runId = String(formData.get("runId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!rowId || !runId) {
    throw new Error("Не указана review row для применения.");
  }

  const row = await prisma.competitorPriceReviewRow.findUnique({
    where: { id: rowId },
  });

  if (!row) {
    throw new Error("Review row не найдена.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.product.update({
      where: { id: row.productId },
      data: {
        price: row.proposedBasePrice,
        options: toNullableJsonValue(row.proposedOptions),
      },
    });

    await transaction.competitorPriceReviewRow.update({
      where: { id: row.id },
      data: {
        status: "applied",
        appliedAt: new Date(),
      },
    });
  });

  await logAdminActivity({
    entityType: "competitor-price-review-row",
    entityId: row.id,
    action: "competitor.pricing.row.applied",
    summary: `Применена review row для товара ${row.productId}.`,
    metadata: {
      runId,
      productId: row.productId,
      proposedBasePrice: Number(row.proposedBasePrice),
    },
  });

  const redirectUrl = buildCompetitorPricingRedirectUrl(runId, category);

  revalidatePath(redirectUrl);
  revalidatePath("/admin/competitor-pricing");
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath("/");
  revalidatePath("/admin/activity");
  redirect(redirectUrl as "/");
}