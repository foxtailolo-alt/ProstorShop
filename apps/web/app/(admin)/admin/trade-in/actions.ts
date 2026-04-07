"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";

const tradeInRequestStatuses = new Set(["new", "contacted", "diagnostics", "completed", "cancelled"]);

export async function upsertTradeInRuleAction(formData: FormData) {
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