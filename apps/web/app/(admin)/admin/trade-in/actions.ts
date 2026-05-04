"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { importTradeInSnapshotSchema } from "../../../../lib/trade-in-snapshot";
import { requirePermission } from "../../../../lib/auth/session";

const tradeInRequestStatuses = new Set(["new", "contacted", "diagnostics", "completed", "cancelled"]);

export async function refreshTradeInSnapshotAction() {
  await requirePermission("trade-in", "write");
  const schema = await importTradeInSnapshotSchema();

  const snapshot = await prisma.$transaction(async (transaction) => {
    const latestSnapshot = await transaction.tradeInSnapshot.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });

    await transaction.tradeInSnapshot.updateMany({
      where: { status: "active" },
      data: { status: "archived" },
    });

    const createdSnapshot = await transaction.tradeInSnapshot.create({
      data: {
        version: (latestSnapshot?.version ?? 0) + 1,
        sourceName: schema.sourceName,
        pricingCity: schema.pricingCity,
        status: "active",
        importedAt: new Date(schema.importedAt),
      },
    });

    for (const category of schema.categories) {
      const createdCategory = await transaction.tradeInSnapshotCategory.create({
        data: {
          snapshotId: createdSnapshot.id,
          categoryCode: category.categoryCode,
          title: category.title,
          isEnabled: category.isEnabled,
          sortOrder: category.sortOrder,
        },
      });

      for (const model of category.models) {
        await transaction.tradeInSnapshotModel.create({
          data: {
            categoryId: createdCategory.id,
            code: model.code,
            title: model.title,
            metadata: model.metadata as Prisma.InputJsonValue,
            sortOrder: model.sortOrder,
            isEnabled: model.isEnabled,
          },
        });
      }

      for (const question of category.questions) {
        const createdQuestion = await transaction.tradeInSnapshotQuestion.create({
          data: {
            categoryId: createdCategory.id,
            code: question.code,
            title: question.title,
            stepIndex: question.stepIndex,
            questionKind: question.questionKind,
            branchingRules: question.branchingRules as Prisma.InputJsonValue,
            isRequired: question.isRequired,
          },
        });

        for (const option of question.options) {
          await transaction.tradeInSnapshotOption.create({
            data: {
              questionId: createdQuestion.id,
              code: option.code,
              title: option.title,
              pricingPayload: option.pricingPayload as Prisma.InputJsonValue,
              sortOrder: option.sortOrder,
              isEnabled: option.isEnabled,
            },
          });
        }
      }
    }

    return createdSnapshot;
  }, {
    maxWait: 10_000,
    timeout: 120_000,
  });

  await logAdminActivity({
    entityType: "trade-in-snapshot",
    entityId: snapshot.id,
    action: "trade-in.snapshot.refreshed",
    summary: `Обновлен trade-in snapshot v${snapshot.version} из DamProdam.`,
    metadata: {
      snapshotId: snapshot.id,
      version: snapshot.version,
      sourceName: schema.sourceName,
      pricingCity: schema.pricingCity,
      categories: schema.categories.length,
    },
  });

  revalidatePath("/trade-in");
  revalidatePath("/admin/trade-in");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
}

export async function upsertTradeInRuleAction(formData: FormData) {
  await requirePermission("trade-in", "write");
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const condition = String(formData.get("condition") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);

  if (!brand || !model || !condition || !Number.isFinite(price) || price <= 0) {
    throw new Error("Trade-in rule form is incomplete.");
  }

  await prisma.tradeInRule.deleteMany({
    where: { brand, model, storage, condition },
  });

  await prisma.tradeInRule.create({
    data: { brand, model, storage, condition, price, isActive: true },
  });

  await logAdminActivity({
    entityType: "trade-in-rule",
    action: "trade-in.rule.saved",
    summary: `Сохранено правило ${brand} ${model} ${storage ?? ""} ${condition}.`,
    metadata: { brand, model, storage, condition, price },
  });

  revalidatePath("/trade-in");
  revalidatePath("/admin/trade-in");
  revalidatePath("/admin/activity");
}

export async function deleteTradeInRuleAction(formData: FormData) {
  await requirePermission("trade-in", "delete");
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const condition = String(formData.get("condition") ?? "").trim();

  await prisma.tradeInRule.deleteMany({
    where: { brand, model, storage, condition },
  });

  await logAdminActivity({
    entityType: "trade-in-rule",
    action: "trade-in.rule.deleted",
    summary: `Удалено правило ${brand} ${model} ${storage ?? ""} ${condition}.`,
    metadata: { brand, model, storage, condition },
  });

  revalidatePath("/trade-in");
  revalidatePath("/admin/trade-in");
  revalidatePath("/admin/activity");
}

export async function updateTradeInRequestStatusAction(formData: FormData) {
  await requirePermission("trade-in", "write");
  const requestId = String(formData.get("requestId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!requestId || !tradeInRequestStatuses.has(status)) {
    throw new Error("Trade-in request status update is invalid.");
  }

  await prisma.tradeInRequest.update({
    where: { id: requestId },
    data: { status },
  });

  await logAdminActivity({
    entityType: "trade-in-request",
    entityId: requestId,
    action: "trade-in.request.status.updated",
    summary: `Статус Trade-in заявки изменен на ${status}.`,
    metadata: { status },
  });

  revalidatePath("/admin/trade-in");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
}